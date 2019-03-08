const httpUtils = require('../../utils')
const creditCardPayment = require('../../paymentHandler/creditCard/credit-card.handler')
const paypalPayment = require('../../paymentHandler/paypal/paypal.handler')
const kcpPayment = require('../../paymentHandler/kcp/kcp-payment.handler')
const fetchPaymentMethods = require('../../paymentHandler/fetch-payment-method.handler')
const ValidatorBuilder = require('../../validator/validator-builder')

const paymentHandlers = {
  creditCardPayment,
  fetchPaymentMethods,
  paypalPayment,
  kcpPayment
}

async function processRequest (request, response) {
  const paymentObject = await _getPaymentObject(request)
  const adyenValidator = ValidatorBuilder.withPayment(paymentObject)
    .validateAdyen()
  if (adyenValidator.hasErrors())
    // if it's not adyen payment, ignore the payment
    return httpUtils.sendResponse(response)
  const interfaceIdValidator = ValidatorBuilder.withPayment(paymentObject)
    .validateInterfaceIdField()
  if (interfaceIdValidator.hasErrors())
    return httpUtils.sendResponse(response, 400, undefined,
      interfaceIdValidator.buildCtpErrorResponse())
  const handler = _getPaymentHandler(paymentObject)
  const handlerResponse = await handler.handlePayment(paymentObject)
  if (handlerResponse.errors)
    return httpUtils.sendResponse(response, 400, undefined, handlerResponse)
  return httpUtils.sendResponse(response, 200, undefined, handlerResponse)
}

async function _getPaymentObject (request) {
  const requestBody = JSON.parse(await httpUtils.collectRequestData(request))
  return requestBody.resource.obj
}

function _getPaymentHandler (paymentObject) {
  const paymentValidator = ValidatorBuilder.withPayment(paymentObject)
  if (paymentValidator.isPaypal())
    return paymentHandlers.paypalPayment
  if (paymentValidator.isCreditCard())
    return paymentHandlers.creditCardPayment
  if (paymentValidator.isKcp())
    return paymentHandlers.kcpPayment
  return paymentHandlers.fetchPaymentMethods
}

module.exports = { processRequest }
