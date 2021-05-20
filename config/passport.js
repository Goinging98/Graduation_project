var passport         = require('passport');
var GoogleStrategy   = require('passport-google-oauth2').Strategy;
const KakaoStrategy = require('passport-kakao').Strategy;
var NaverStrategy = require('passport-naver').Strategy;

require('dotenv').config();

passport.serializeUser(function(user, done) {
  done(null, user);
});
passport.deserializeUser(function(user, done) {
  done(null, user);
});

passport.use(new GoogleStrategy(
  {
    clientID      : process.env.GOOGLE_CLIENT_ID,
    clientSecret  : process.env.GOOGLE_SECRET,
    callbackURL   : '/auth/google/callback',
    passReqToCallback   : true
  }, function(request, accessToken, refreshToken, profile, done){
    console.log('profile: ', profile);
    var user = profile;

    done(null, user);
  }
));

passport.use('kakao', new KakaoStrategy({
  clientID: process.env.KAKAO_ID,
  callbackURL: '/auth/kakao/callback', 
}, async (accessToken, refreshToken, profile, done) => {
  var user = profile;
  console.log('profile: ', user);
  done(null, user);
}))

//별도 config 파일에 '네아로'에 신청한 정보 입력 
passport.use(new NaverStrategy({ 
  clientID: process.env.clientID, 
  clientSecret: process.env.clientSecret, 
  callbackURL: '/auth/naver/callback' 
}, 
function(accessToken, refreshToken, profile, done) { 
  process.nextTick(function () { 
    var user = { 
      name: profile.displayName, 
      email: profile.emails[0].value, 
      username: profile.displayName, 
      provider: 'naver', 
      naver: profile._json }; 
      console.log("user=");   
      console.log(user); 
      var user = profile;
      return done(null, user); 
    }); 
  } 
)); 
//failed to serialize user into session 에러 발생 시 아래의 내용을 추가 한다. 
passport.serializeUser(function(user, done) { 
  done(null, user); 
}); 

passport.deserializeUser(function(req, user, done) { 
  // passport로 로그인 처리 후 해당 정보를 session에 담는다. 
  req.session.sid = user.name; 
  console.log("Session Check :" +req.session.sid); 
  done(null, user); 
});


module.exports = passport;