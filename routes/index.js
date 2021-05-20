var express  = require('express');
var router   = express.Router();

router.get('/', function(req,res){
  res.render('index', {user: req.user});
});

router.use('/auth', require('./auth'));
module.exports = router;
