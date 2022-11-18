const { Router } = require('express')
const {
  register,
  attachMethod,
  createPayment,
  confirmPayment,
  setupIntent,
  createSubscription,
  cancelSubscription,
  getUserData,
} = require('./controller/stripe')

const router = Router()

router.get('/user/:id', getUserData)
router.post('/payment/register', register)

router.post('/payment/setupIntent', setupIntent)

router.post('/payment/method/attach', attachMethod)

// Gamer REST API
router.post('/payment/create', createPayment)

router.post('/payment/subscription/create', createSubscription)
router.post('/payment/subscription/cancel', cancelSubscription)

router.post('/payment/confirm', confirmPayment)

// Event REST API

module.exports = router
