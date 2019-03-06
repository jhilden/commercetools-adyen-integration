const fetch = require('node-fetch')

const c = require('../../config/constants')
const configLoader = require('../../config/config')
const pU = require('../payment-utils')
const ValidatorBuilder = require('../../validator/validatorBuilder')

const config = configLoader.load()

async function handlePayment (paymentObject) {
  const validator = _validatePayment(paymentObject)
  if (validator.hasErrors())
    return validator.buildCtpErrorResponse()

  const { response, request } = await _callAdyen(paymentObject)
  const interfaceInteractionStatus = response.status === 200 ? c.SUCCESS : c.FAILURE
  const responseBody = await response.json()
  const actions = [
    {
      action: 'addInterfaceInteraction',
      type: { key: c.CTP_INTERFACE_INTERACTION },
      fields: {
        timestamp: new Date(),
        response: JSON.stringify(responseBody),
        request: JSON.stringify(request),
        type: 'makePayment',
        status: interfaceInteractionStatus
      }
    }
  ]
  if (responseBody.resultCode === c.REDIRECT_SHOPPER) {
    const transaction = pU.getChargeTransactionInit(paymentObject)
    const redirectUrl = responseBody.redirect.url
    actions.push({
      action: 'setCustomField',
      name: 'redirectUrl',
      value: redirectUrl
    })
    const redirectMethod = responseBody.redirect.method
    actions.push({
      action: 'setCustomField',
      name: 'redirectMethod',
      value: redirectMethod
    })
    actions.push({
      action: 'changeTransactionState',
      transactionId: transaction.id,
      state: 'Pending'
    })
  }
  return {
    version: paymentObject.version,
    actions
  }
}

function _validatePayment (paymentObject) {
  return ValidatorBuilder.withPayment(paymentObject)
    .validateReturnUrlField()
}

async function _callAdyen (paymentObject) {
  const transaction = pU.getChargeTransactionInit(paymentObject)
  const body = {
    merchantAccount: config.adyen.merchantAccount,
    amount: {
      currency: transaction.amount.currencyCode,
      value: transaction.amount.centAmount
    },
    reference: paymentObject.interfaceId,
    paymentMethod: {
      type: 'paypal'
    },
    returnUrl: paymentObject.custom.fields.returnUrl
  }

  const request = {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'x-api-key': config.adyen.apiKey, 'Content-Type': 'application/json' }
  }
  const response = await fetch(`${config.adyen.apiBaseUrl}/payments`, request)

  return { response, request }
}

module.exports = { handlePayment }
