var express  = require('express');
var router   = express.Router();
var passport = require('../config/passport.js');
const { isNotLoggedIn, isLoggedIn } = require('./middlewares');

router.get('/naver',
  passport.authenticate('naver',{ scope: ['profile'] })
);

//처리 후 callback 처리 부분 성공/실패 시 리다이렉트 설정 
router.get('/naver/callback', passport.authenticate('naver', { 
  successRedirect: '/main', 
  failureRedirect: 'auth/login' }) 
  );

router.get('/kakao', 
  passport.authenticate('kakao', { scope: ['profile'] })
);

router.get('/kakao/callback', 
  passport.authenticate('kakao'), authSuccess
);


router.get('/login', function(req,res){
  res.render('auth/login');
});

//로그아웃
router.get('/logout', isLoggedIn,(req,res)=>{
  req.logout();
  req.session.destroy();
  res.redirect('/');
})


router.get('/google',
  passport.authenticate('google', { scope: ['profile'] })
);

router.get('/google/callback',
  passport.authenticate('google'), authSuccess
);

function authSuccess(req, res) {
  res.redirect('/main');
}




module.exports = router;