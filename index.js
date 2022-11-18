const express = require('express')
const cors = require('cors')
const router = require('./router')
const { initPrice } = require('./controller/stripe')

const app = express()

app.use(express.json())
app.use(cors())

app.use('/api', router)

initPrice()

app.listen(8000, () => {
  console.log('Server is running')
})
