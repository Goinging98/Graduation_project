if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')

const initializePassport = require('./passport-config')
initializePassport(
  passport,
  email => users.find(user => user.email === email),
  id => users.find(user => user.id === id)
)

const users = []

app.set('view-engine', 'ejs')

app.use(express.urlencoded({ extended: false }))
app.use(flash())
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))
app.use(express.static('public')) //이미지 파일



app.get('/', (req, res) => {
  res.render('index.ejs')
})

app.get('/aboutUs', (req, res) => {
  res.render('aboutUs.ejs')
})

app.get('/contactUs', (req, res) => {
  res.render('contactUs.ejs')
})


app.get('/main', checkAuthenticated, (req, res) => {
  res.render('main.ejs', { name: req.user.name })
})

app.get('/main0', checkAuthenticated, (req, res) => {
  res.render('main0.ejs', {})
})

app.get('/main1', checkAuthenticated, (req, res) => {
  res.render('main1.ejs', {})
})

app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login.ejs')
})



app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
  successRedirect: '/main',
  failureRedirect: '/login',
  failureFlash: true
}))

app.get('/register', checkNotAuthenticated, (req, res) => {
  res.render('register.ejs')
})

app.post('/register', checkNotAuthenticated, async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10)
    users.push({
      id: Date.now().toString(),
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword
    })
    res.redirect('/login')
  } catch {
    res.redirect('/register')
  }
})

app.delete('/logout', (req, res) => {
  req.logOut()
  res.redirect('/login')
})

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }

  res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/main')
  }
  next()
}



/*
//db연결
const mongoose = require('mongoose')
mongoose.connect(process.env.DATABASE_URL, { useNewUrlParser: true })
const db = mongoose.connection
db.on('error', error => console.error(error))
db.once('open', () => console.log('Connected to Mongoose'))
*/

app.listen(3000)
