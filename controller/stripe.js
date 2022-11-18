const stripe = require('stripe')(require('../config.json').stripeSecretKey)

const users = []
let price

const initPrice = async () => {
  try {
    const product = await stripe.products.create({
      name: 'Basic Dashboard',
      default_price_data: {
        unit_amount: 1000,
        currency: 'gbp',
        recurring: { interval: 'month' },
      },
      expand: ['default_price'],
    })
    price = product.default_price
  } catch {}
}

async function createStripeCustomer({ name, email, phone }) {
  return new Promise(async (resolve, reject) => {
    try {
      const Customer = await stripe.customers.create({
        name: name,
        email: email,
        phone: phone,
      })

      resolve(Customer)
    } catch (err) {
      console.log(err)
      reject(err)
    }
  })
}

const getUserData = (req, res) => {
  try {
    const { id } = req.params
    const numId = Number(id)
    const user = users.find(({ id: userId }) => userId === numId)
    res.status(200).json({ user })
  } catch {
    res.status(400).json({ message: 'An error occured' })
  }
}

const register = async (req, res) => {
  const { email, name, password, phone } = req.body

  /*  Add this user in your database and store stripe's customer id against the user   */
  try {
    const existingCustomers = await stripe.customers.list({
      email,
    })

    let customer = null
    if (existingCustomers.data.length != 0) {
      customer = existingCustomers.data[0]
      res.status(200).send({
        customer: existingCustomers.data[0],
        message: 'User Already Exists',
      })
    } else {
      customer = await createStripeCustomer({
        email,
        name,
        password,
        phone,
      })
      res.status(200).json({ message: 'Customer created', customer })
    }

    if (customer) {
      const oldUser = users.find(({ customerId }) => customerId === customer.id)
      if (!oldUser) {
        users.push({
          id: users.length,
          email,
          name,
          password,
          phone,
          customerId: customer.id,
          customer: customer,
        })
      }
    }
  } catch (err) {
    console.log(err)
    res.status(400).json({ message: 'An error occured' })
  }
}

const attachMethod = async (req, res) => {
  const { paymentMethod } = req.body

  /* Fetch the Customer Id of current logged in user from the database */
  try {
    const method = await attachMethod({ paymentMethod, customerId })
    console.log(method)
    res.status(200).json({ message: 'Payment method attached succesully' })
  } catch (err) {
    console.log(err)
    res.status(400).json({ message: 'Could not attach method' })
  }
}

// Gamer REST API
const createPayment = async (req, res) => {
  const { amount, customerId } = req.body
  /*  Add this user in your database and store stripe's customer id against the user   */
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      customer: customerId,
      currency: 'gbp',
      payment_method_types: ['card', 'bacs_debit'],
    })
    res.status(200).json({ paymentIntent, message: 'Customer created' })
  } catch (err) {
    console.log(err)
    res.status(400).json({ message: 'An error occured' })
  }
}

const setupIntent = async (req, res) => {
  const { customerId } = req.body
  /*  Add this user in your database and store stripe's customer id against the user   */
  try {
    const intent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    })
    res.status(200).json({ intent, message: 'Customer created' })
  } catch (err) {
    console.log(err)
    res.status(400).json({ message: 'An error occured' })
  }
}

const createSubscription = async (req, res) => {
  let customer_id = req.body.customer.id
  let payment_method = req.body.payment_method
  let email = req.body.customer.email

  // Attach the  payment method to the customer
  await stripe.paymentMethods.attach(payment_method, { customer: customer_id })

  // Set it as the default payment method for the customer account
  await stripe.customers.update(customer_id, {
    invoice_settings: { default_payment_method: payment_method },
  })

  const subscription = await stripe.subscriptions.create({
    customer: customer_id,
    items: [{ price: price.id }],
    default_payment_method: payment_method,
    trial_period_days: 1,
  })

  let subscriptionId = subscription.id

  if (
    subscription.status === 'succeeded' ||
    subscription.status === 'trialing'
  ) {
    //update db to users subscription
    user = users.find(({ email: userEmail }) => userEmail === email)
    if (user && user.customerId === customer_id) {
      user.subscriptionId = subscriptionId
      user.subscription = subscription
    }

    res.send(subscription)
  } else {
    //if subscription fails send error message
    res.status(400).send({
      type: 'Stripe Purchase Error',
      message: 'Stripe Server Side Purchase Failed',
    })
    return
  }
}

const cancelSubscription = async (req, res) => {
  const { email } = req.body

  // find user from db
  const user = users.find(({ email: userEmail }) => email === userEmail)
  if (user && user.subscriptionId) {
    const subscription = await stripe.subscriptions.del(user.subscriptionId)
    if (subscription.status === 'canceled') {
      //update our own db for canceled subscription
      delete user.subscription
      delete user.subscriptionId

      res.status(200).send({
        type: 'Request Successful',
        message: 'Subscription Successfully Canceled',
      })
    }
  }
}

const confirmPayment = async (req, res) => {
  const { paymentIntent } = req.body
  try {
    const intent = await stripe.paymentIntents.confirm(paymentIntent)

    /* Update the status of the payment to indicate confirmation */
    res.status(200).json(intent)
  } catch (err) {
    res.status(500).json(err)
  }
}

module.exports = {
  createPayment,
  confirmPayment,
  attachMethod,
  register,
  setupIntent,
  createSubscription,
  cancelSubscription,
  initPrice,
  getUserData,
}
