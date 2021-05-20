var aws = require('aws-sdk'),
    bodyParser = require('body-parser'),
    multer = require('multer'),
    multerS3 = require('multer-s3');
const { Router } = require('express');
var mongoose = require('mongoose');
var Detail = require('./models/detail');
var ExtractData = require('./models/extractData');
var Trashcan = require('./models/trashcan');
var EventModel = require('./models/event');
var fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { Poppler } = require("node-poppler");

const ObjectID = require('mongodb').ObjectID;
const express = require('express');
const app = express();
const methodOverride = require('method-override');
var passport  = require('passport');
var session   = require('express-session');
require('dotenv').config();
const fetch = require("node-fetch");
const { data } = require('jquery');

// 진행중인 계약서와 완료된 계약서 구분변수
let today = new Date(); 

//데이터링크 보호변수
var s3_image_url = process.env.S3_IMAGE_URL

// s3 접근 코드
aws.config.update({
  accessKeyId: process.env.ACCESSKEYID,
  secretAccessKey: process.env.SECRETACCESSKEY,     
  region: process.env.REGION
});

// 구글로그인
app.set('view engine', 'ejs');
app.use(session({secret:'MySecret', resave: false, saveUninitialized:true}));

// Passport 설정
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));


const authenticateUser = (req, res, next) => {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.status(301).redirect('/auth/login');
  }
};


// 몽고 디비 연결하기
async function main() {
  
   const client = mongoose.connect(process.env.DATABASE_URL,
    {
       useNewUrlParser: true,
       useUnifiedTopology: true,
       useCreateIndex: true
   },
   () => {
       console.log("Connected to mongodb");    
   }
  );
  try {
    
    await init(client);

  } catch (e) {
    console.error(e);
  }
  }
main().catch(console.err);



app.set('view-engine', 'ejs')
app.use(methodOverride('_method'))
app.use(express.static('public'))
s3 = new aws.S3();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// s3 업로드 코드
var upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.BUCKET_NAME,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: function (req, file, cb) {
            cb(null, file.originalname);
        }
    })
});


//Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}));

//Set static folder
app.use(express.static(path.join(__dirname, 'public')));

//Creating http server
var server = require('http').createServer(app);


//메인페이지
app.get('/main', authenticateUser, function(req, res){
  var continuee = new Array();
 var finish = new Array();

 // 종료된 계약서의 green 항목
 ExtractData.find({$and:[{user:req.user.id },{"endDate":{"$lte":today.toLocaleDateString()}}, {"risk":"green"}]}, function(err, extract) {
  finish.push(extract.length);
   // 종료된 계약서의 yellow항목
   ExtractData.find({$and:[{user:req.user.id },{"endDate":{"$lte":today.toLocaleDateString()}}, {"risk":"yellow"}]}, function(err, extract) {
     finish.push(extract.length);
     // 종료된 계약서의 red 항목
     ExtractData.find({$and:[{user:req.user.id },{"endDate":{"$lte":today.toLocaleDateString()}}, {"risk":"red"}]}, function(err, extract) {
      finish.push(extract.length);
      ExtractData.find({$and:[{user:req.user.id },{"endDate":{"$gt":today.toLocaleDateString()}}, {"risk":"green"}]}, function(err, extract) {
        continuee.push(extract.length);
        ExtractData.find({$and:[{user:req.user.id },{"endDate":{"$gt":today.toLocaleDateString()}}, {"risk":"yellow"}]}, function(err, extract) {
          continuee.push(extract.length);
          ExtractData.find({$and:[{user:req.user.id },{"endDate":{"$gt":today.toLocaleDateString()}}, {"risk":"red"}]}, function(err, extract) {
            continuee.push(extract.length);
            res.render('main.ejs', {user:req.user, con: continuee, finish:finish, data:data}); 
             
          });
        });
      });
    });
   });
 });
});

//달력 기능 함수정의
async function init(client) {
   
   app.use(bodyParser.json());
   app.use(bodyParser.urlencoded({ extended: false })); 

   app.get('/main/data', authenticateUser, function (req, res) {
     
    EventModel.find({user:req.user.id }, function (err, data) {
         for (var i = 0; i < data.length; i++){
            data[i].id = data[i]._id;
            delete data[i]["!nativeeditor_status"];
         }
         res.send(data);
      });
   });

   app.post('/main/data', authenticateUser, function (req, res) {
      var data = req.body;
      var mode = data["!nativeeditor_status"];
      var sid = data.id;
      var tid = sid;
      
      function update_response(err) {
         if (err)
            mode = "error";
         else if (mode == "inserted"){
            tid = data._id;
         }
         res.setHeader("Content-Type", "application/json");
         res.send({ action: mode, sid: sid, tid: String(tid) });
      }

      if (mode == "updated") {
        EventModel.updateOne({"_id": ObjectID(tid)}, {$set: data}, update_response);
      } else if (mode == "inserted") {
        var eventModel = new EventModel({
          user:req.user.id,
          start_date: data.start_date,
          end_date: data.end_date,
          text: data.text,
          id: tid
          })
        eventModel.save(update_response, function(error, eventModel){
          if(error){
              console.log(error);
          }else{
             
          }
      });
      } else if (mode == "deleted") {
        EventModel.deleteOne({"_id": ObjectID(tid)}, update_response)
        
      } else
         res.send("Not supported operation");
   });
};


//홈페이지 처음화면
app.get('/', (req, res) => {
  res.render('index.ejs')
})

//계약서 미리보기
app.get('/contracts/pdfView/:id', authenticateUser, (req, res) => {
  Detail.find({ _id: req.params.id }, (err, products) => {
    res.render('pdfView.ejs', { data: products , image_url : s3_image_url});
    
  });
})

//계약서 이름 수정 도중 다른 계약서 확인코드
app.get('/edit/contracts/:id',authenticateUser,(req,res,next)=>{
  ExtractData.find({_id:req.params.id},(err,extract)=>{
    if(extract.length == 1){
      Detail.find({ _id: req.params.id }, (err, products) => {    
        res.render('contract4.ejs', { data: products ,extract,user: req.user, image_url : s3_image_url})
      });
      
    }else{
      // 계약서 분석하기 버튼을 누르지 않은 경우 이미지만 뜨는 contract2.ejs 파일임.
      Detail.find({ _id: req.params.id }, (err, products) => {
        res.render('contract2.ejs', { data: products ,user: req.user, image_url : s3_image_url});
        
      });
    }
  })
})

//계약서이름변경
app.get('/edit/:id',authenticateUser,(req,res,next)=>{
  var page = Math.max(1,req.query.page);
  var limit = 10;
  
  Detail.countDocuments({user:req.user.id},function(err,count){
    if(err) return res.json({success:false, message:err});
    var skip = (page-1)*limit;
    var maxPage = Math.ceil(count/limit);

    Detail.find({user:req.user.id}).skip(skip).limit(limit).exec(function (err,products) {      
      if(err) return res.json({success:false, message:err});
      ExtractData.find({},(err,extract)=>{
        res.render('edit.ejs', { data: products,extract, page:page, maxPage:maxPage,user: req.user,x:req.params.id});
      })    
    });
  });
})

 // 이름변경 완료코드
 app.post('/edit/:id',authenticateUser, async (req, res) => {
   let { id } = req.params;
   await Detail.updateOne({_id: id}, req.body);
   await ExtractData.updateOne({ _id: id }, req.body)
   res.redirect('/contracts');
 })


// 완전 삭제
app.get('/trashcan/:id/:user/delete',authenticateUser,(req,res)=>{
  Trashcan.find({ $and: [ { _id: req.params.id }, {user:req.params.user } ] }, (err, products) => {
    res.redirect('/trashcan');
    Trashcan.deleteOne({$and: [ { _id: req.params.id }, {user:req.params.user } ]},(err,products)=>{
      
    })
  });
});

// 쓰레기통에 있는 파일 복원 하는 코드
app.get('/trashcan/:id/:user/recovery',authenticateUser,(req,res)=>{
  Trashcan.find({ $and: [ { _id: req.params.id }, {user:req.params.user } ] }, (err, products) => {
    res.redirect('/trashcan');
    var document = {
      id:         req.params.id,
      user:       req.params.user,
      title:      products[0].title,
      pdf_name:   products[0].pdf_name,
      image2:     products[0].image2,
      image3:     products[0].image3,
      added_date: products[0].added_date
    };

    var detail = new Detail(document);

      detail.save(function(err, detail){
        if(err) return console.error(err);
      });

      Trashcan.deleteOne({$and: [ { _id: req.params.id }, {user:req.params.user } ]},(err,products)=>{

      })
  });
});


let a='';
let b='';
let b1='';
let b2='';
let b3='';
let b4='';
let b5='';
let b6='';

//계약서 이름 클릭해서 들어가는 코드
app.get('/contracts/:id',authenticateUser,(req,res)=>{
  ExtractData.find({_id:req.params.id},(err,extract)=>{
    if(extract.length == 1){
      Detail.find({ _id: req.params.id }, (err, products) => {    
        res.render('contract4.ejs', { data: products ,extract,user: req.user, image_url : s3_image_url})
      });
    }else{
      // 계약서 분석하기 버튼을 누르지 않은 경우 이미지만 뜨는 contract2.ejs 파일임.
      Detail.find({ _id: req.params.id }, (err, products) => {
        res.render('contract2.ejs', { data: products ,user: req.user, image_url : s3_image_url});
        
      });
    }
  })
  
});

//분석하기 버튼을 누르자마자 계약서를 확인하는 코드
app.get('/extract/:id/:user/:id',authenticateUser,(req,res)=>{
  ExtractData.find({_id:req.params.id},(err,extract)=>{
    if(extract.length == 1){
      Detail.find({ _id: req.params.id }, (err, products) => {    
        res.render('contract4.ejs', { data: products ,extract,user: req.user, image_url : s3_image_url})
      });
      
    }else{
      // 계약서 추출하기 버튼을 누르지 않은 경우 이미지만 뜨는 contract2.ejs 파일임.
      Detail.find({ _id: req.params.id }, (err, products) => {
        res.render('contract2.ejs', { data: products ,user: req.user, image_url : s3_image_url});
        
      });
    }
  })
  
});

//전체 계약서 페이지에서 계약서 삭제할 때
app.get('/contracts/:id/:user/delete',authenticateUser,(req,res)=>{
  Detail.find({  $and: [ { _id: req.params.id }, {user:req.params.user } ] }, (err, products) => {
    
    var document = {
      id:         req.params.id,
      user:       req.params.user,
      title:      products[0].title,
      pdf_name:   products[0].pdf_name,
      image2:     products[0].image2,
      image3:     products[0].image3,
      added_date: products[0].added_date
    };

    var trashcan = new Trashcan(document);
      trashcan.save(function(err, trashcan){
        if(err) return console.error(err);
      });

      Detail.deleteOne({_id:req.params.id},(err,products)=>{

      })

      ExtractData.deleteOne({_id:req.params.id},(err,products)=>{

      })
      EventModel.deleteOne({id:req.params.id},(err,products)=>{

      })
      res.redirect('/contracts');
  });
});

//완료된 계약서 페이지에서 계약서 삭제
app.get('/expired/:id/:user/delete',authenticateUser,(req,res)=>{
  Detail.find({  $and: [ { _id: req.params.id }, {user:req.params.user } ] }, (err, products) => {
    var document = {
      id:         req.params.id,
      user:       req.params.user,
      title:      products[0].title,
      pdf_name:   products[0].pdf_name,
      image2:     products[0].image2,
      image3:     products[0].image3,
      added_date: products[0].added_date
    };
    var trashcan = new Trashcan(document);
      trashcan.save(function(err, trashcan){
        if(err) return console.error(err);
      });
      Detail.deleteOne({_id:req.params.id},(err,products)=>{
      })
      ExtractData.deleteOne({_id:req.params.id},(err,products)=>{
      })
      EventModel.deleteOne({id:req.params.id},(err,products)=>{
      })
      res.redirect('/expired');
  });
});

//진행중인 계약서 페이지에서 계약서 삭제할 때
app.get('/continuing/:id/:user/delete',authenticateUser,(req,res)=>{
  Detail.find({  $and: [ { _id: req.params.id }, {user:req.params.user } ] }, (err, products) => {
    var document = {
      id:         req.params.id,
      user:       req.params.user,
      title:      products[0].title,
      pdf_name:   products[0].pdf_name,
      image2:     products[0].image2,
      image3:     products[0].image3,
      added_date: products[0].added_date
    };
    var trashcan = new Trashcan(document);
      trashcan.save(function(err, trashcan){
        if(err) return console.error(err);
      });
      Detail.deleteOne({_id:req.params.id},(err,products)=>{
      })
      ExtractData.deleteOne({_id:req.params.id},(err,products)=>{
      })
      EventModel.deleteOne({id:req.params.id},(err,products)=>{
      })
      res.redirect('/continuing');
  });
});

//계약서 업로드 할 때
app.post('/uploadSuccess', upload.array('uploadFile',100), authenticateUser,function (req, res, next) {
  var pagecount = 0;
  var file = require('fs').createWriteStream(req.files[0].key)
  var params = {Bucket:process.env.BUCKET_NAME, Key:req.files[0].key};
  s3.getObject(params).createReadStream().pipe(file);  
  const file2 = req.files[0].key;
  
  // s3 업로드 후 1초 후 실행 
  setTimeout(function () {
    let dataBuffer2 = fs.readFileSync(file2);
    pdf(dataBuffer2).then(function(data) {
        pagecount = data.numpages;
    })
    .catch(function(error){
        console.log(error);
    })
    
    const poppler = new Poppler();
    const options = {
      firstPageToConvert: 1,
      lastPageToConvert: pagecount,
      pngFile: true,
    };
    const outputFile = req.files[0].key;
    
    //pdf계약서를 이미지파일로 변경
    const res2 = poppler.pdfToCairo(file2, outputFile, options) 
                    .then((response)=>{
                      var uploadFile = []
                      var imageFullName = []
                      
                      for(var i = 1; i<pagecount+1; i ++){
                        uploadFile.push(req.files[0].key + "-" + i)
                        imageFullName.push(req.files[0].key + "-" + i + '.png')
                      }
                      
                      for(var i=0;i<pagecount; i++){
                        var filename = uploadFile[i] + '.png';
                        var uploadParams = {Bucket: process.env.BUCKET_NAME, Key: '', Body: ''};
                        var fileStream = fs.createReadStream(filename);
                        fileStream.on('error', function(err) {
                          console.log('File Error', err);
                        });
                        uploadParams.Body = fileStream;
                        uploadParams.Key = path.basename(filename);

                        s3.upload (uploadParams, function (err, data) {  
                          if (err) {
                            console.log("Error", err);
                          } if (data) {
                            console.log("Upload Success");
                          }
                        });
                      }
                      
                      let imgname1 = "";
                      let imgname = "https://s3.ap-northeast-2.amazonaws.com/" + process.env.BUCKET_NAME + "/";
                      var arr = [];
                      var k=[];
                      for(var i=0; i<imageFullName.length; i++){
                        arr.push(imgname + imageFullName[i]);
                      }
                      for(var i=0; i<imageFullName.length; i++){
                        k.push( imageFullName[i]);
                      }
                      
                      var document = {
                        id:         req.body.name,
                        user:       req.user.id,
                        title:      req.body.name,
                        pdf_name:   req.files[0].key,
                        image2:     arr,
                        image3:     k
                      };

                      var detail = new Detail(document); 
                    
                      detail.save(function(err, detail){
                        if(err) return console.error(err);
                        
                      });

                    })
                    .then((response)=>{
                      res.redirect('/contracts');
                    })
                    .catch(function(error){
                        console.log(error);
                    });
  }, 1000);
});

//계약서 분석하기 버튼 클릭했을 때
app.get('/extract/:id/:user',authenticateUser,(req,res)=>{
  var a1=0;
  var a2=0;

  var extract;
  Detail.find({ $and: [ { _id: req.params.id }, {user:req.params.user } ]  }, (err, products) => {
    var k=JSON.parse(JSON.stringify(products))
  
    var fetch_url = process.env.X_API_KEY
    fetch(process.env.FETCH_URL, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': fetch_url,
      },
      body: JSON.stringify({
        "0": k[0]["image2"][0],
        "1": k[0]["image2"][1],
        "2": k[0]["image2"][2],
        "3": k[0]["image2"][3],
        "4": k[0]["image2"][4],
      }),
    })
    .then((response) => response.json())
    .then((data) => extract=data)
    .then((response)=>console.log(extract))
    .then((response)=>{
      if(extract.result.계약시작일.risk=='red'||extract.result.계약종료일.risk=='red'||extract.result.계약일.risk=='red'||extract.result.착수금.risk=='red'||extract.result.중도금.risk=='red'||extract.result.잔금.risk=='red'||extract.result.계약금.risk=='red'){
        a="red"
      }else if(extract.result.계약시작일.risk=='yellow'&&extract.result.계약종료일.risk=='yellow'&&extract.result.계약일.risk=='yellow'&&extract.result.착수금.risk=='yellow'&&extract.result.중도금.risk=='yellow'&&extract.result.잔금.risk=='yellow'&&extract.result.계약금.risk=='yellow'){
        a="yellow"
      }else{
        a="green"
      } 
      if(extract.result.계약시작일.risk=='red'){b="계약시작일:"+extract.result.계약시작일.reference}
      if(extract.result.계약종료일.risk=='red'){b1="계약종료일:"+extract.result.계약종료일.reference}
      if(extract.result.계약일.risk=='red'){b2="계약일:"+extract.result.계약일.reference}
      if(extract.result.착수금.risk=='red'){b3="착수금:"+extract.result.착수금.reference}
      if(extract.result.중도금.risk=='red'){b4="중도금:"+extract.result.중도금.reference}
      if(extract.result.잔금.risk=='red'){b5="잔금:"+extract.result.잔금.reference}
      if(extract.result.계약금.risk=='red'){b6="계약금:"+extract.result.계약금.reference}

      if(extract.result.계약시작일.risk=='yellow'){b="계약시작일:"+extract.result.계약시작일.reference}
      if(extract.result.계약종료일.risk=='yellow'){b1="계약종료일:"+extract.result.계약종료일.reference}
      if(extract.result.계약일.risk=='yellow'){b2="계약일:"+extract.result.계약일.reference}
      if(extract.result.착수금.risk=='yellow'){b3="착수금:"+extract.result.착수금.reference}
      if(extract.result.중도금.risk=='yellow'){b4="중도금:"+extract.result.중도금.reference}
      if(extract.result.잔금.risk=='yellow'){b5="잔금:"+extract.result.잔금.reference}
      if(extract.result.계약금.risk=='yellow'){b6="계약금:"+extract.result.계약금.reference}


      var document = {
        _id: req.params.id,
        title:products[0].title,
        user: req.params.user,
        startDate:  extract.result.계약시작일.searching,   
        startDatePosition:  extract.result.계약시작일.position,
        endDate:  extract.result.계약종료일.searching,
        endDatePosition:  extract.result.계약종료일.position,
        contractDate: extract.result.계약일.searching,
        deposit:  extract.result.착수금.searching,
        secondPayment:  extract.result.중도금.searching,
        balance:  extract.result.잔금.searching,
        downPayment:  extract.result.계약금.searching,
        downPaymentPosition:  extract.result.계약금.position,        
        startrisk:  extract.result.계약시작일.risk,
        endrisk:  extract.result.계약종료일.risk,
        dayrisk:  extract.result.계약일.risk,
        depositrisk:  extract.result.착수금.risk,
        secondPaymentrisk:  extract.result.중도금.risk,
        balencerisk:  extract.result.잔금.risk,
        moneyrisk:  extract.result.계약금.risk,       
        startreference:  extract.result.계약시작일.reference,
        endreference:  extract.result.계약종료일.reference,
        dayreference:  extract.result.계약일.reference,
        depositreference:  extract.result.착수금.reference,
        secondPaymentreference:  extract.result.중도금.reference,
        balencereference:  extract.result.잔금.reference,
        moneyreference:  extract.result.계약금.reference,
        risk:a  

      };    
    
      var date = extract.result.계약종료일.searching + " 00:00";
      var date = new Date(date);
      var tomorrow = new Date(date.setDate(date.getDate()+1));
      var yesterday = new Date(date.setDate(date.getDate()-1))
      var eventModel = new EventModel({
        user: req.user.id,
        start_date: yesterday,
        end_date: tomorrow,
        text: products[0].title +"의 계약 종료일입니다.",
        id: req.params.id
      });
      eventModel.save(function(error, eventModel){
        if(error){
            console.log(error);
        }else{
            
        }
      });

      var extractData = new ExtractData(document); 
      extractData.save(function(err, extractData){
        if(err) return console.error(err);        
      });
    }).then((response)=>  
    Detail.countDocuments({user:req.user.id},function(err,count){
      var limit = 10; 
      var page = Math.max(1,req.query.page);
      if(err) return res.json({success:false, message:err});
      var skip = (page-1)*limit;
      var maxPage = Math.ceil(count/limit);
  
      Detail.find({user:req.user.id}).skip(skip).limit(limit).exec(function (err,products) {      
        if(err) return res.json({success:false, message:err});
        ExtractData.find({},(err,extract)=>{
          res.render('contracts.ejs', { data: products,extract, page:page, maxPage:maxPage,user: req.user});
        })    
      });
    }))
    .catch(err => console.log(err))
  });
});

//전체계약서 페이지
app.get('/contracts',authenticateUser,(req,res,next)=>{
    var page = Math.max(1,req.query.page);
    var limit = 10;
    
    Detail.countDocuments({user:req.user.id},function(err,count){
      if(err) return res.json({success:false, message:err});
      var skip = (page-1)*limit;
      var maxPage = Math.ceil(count/limit);
  
      Detail.find({user:req.user.id}).skip(skip).limit(limit).exec(function (err,products) {      
        if(err) return res.json({success:false, message:err});
        ExtractData.find({},(err,extract)=>{
          res.render('contracts.ejs', { data: products,extract, page:page, maxPage:maxPage,user: req.user});
        })    
      });
    });
})

//휴지통
app.get('/trashcan',authenticateUser,(req,res)=>{
  var page = Math.max(1,req.query.page);
    var limit = 10;
    Trashcan.countDocuments({user:req.user.id},function(err,count){
      if(err) return res.json({success:false, message:err});
      var skip = (page-1)*limit;
      var maxPage = Math.ceil(count/limit);
  Trashcan.find({user:req.user.id}).skip(skip).limit(limit).exec(function (err,products) {      
    if (err){
        console.log(err);
    }else{
        res.render('trashcan.ejs',{ data: products, page:page, maxPage:maxPage,user: req.user})
    }
  });
})})

//완료된 계약서 페이지
app.get('/expired',authenticateUser,(req,res,next)=>{
  var page = Math.max(1,req.query.page);
  var limit = 10;
  ExtractData.countDocuments({$and:[{user:req.user.id },{"endDate":{"$lte":today.toLocaleDateString()}}]},function(err,count){
    if(err) return res.json({success:false, message:err});
    var skip = (page-1)*limit;
    var maxPage = Math.ceil(count/limit);

  ExtractData.find({$and:[{user:req.user.id },{"endDate":{"$lte":today.toLocaleDateString()}}]}, function(err, extract) {
    if (err){
        console.log(err);
    }else{
      var number = extract.length;
      var result = new Array();
      var num = 0;
      for(var i=0; i < number; i++){
        Detail.find({"_id":{"$eq":extract[i]._id}}, function(err, products) {
          if (err){
              console.log(err);
          }else{
            num += 1;
            result.push(products[0]);
            if(num==number){
              res.render('expired.ejs', { data: result,extract,user: req.user, page:page, maxPage:maxPage});
            }
          }
      });
      }
      if(number ==0){
        res.render('expired.ejs', { data: result,extract,user: req.user, page:page, maxPage:maxPage});
      }
    }
  });})

})

//진행중인 계약서 페이지
app.get('/continuing',authenticateUser,(req,res,next)=>{
  var page = Math.max(1,req.query.page);
    var limit = 10;
    ExtractData.countDocuments({$and:[{user:req.user.id },{"endDate":{"$gt":today.toLocaleDateString()}}]},function(err,count){
      if(err) return res.json({success:false, message:err});
      var skip = (page-1)*limit;
      var maxPage = Math.ceil(count/limit);

  ExtractData.find({$and:[{user:req.user.id },{"endDate":{"$gt":today.toLocaleDateString()}}]}, function(err, extract) {
    if (err){
        console.log(err);
    }else{
      var number = extract.length;
      var result = new Array();
      var num = 0;
      for(var i=0; i < number; i++){
        Detail.find({"_id":{"$eq":extract[i]._id}}).skip(skip).limit(limit).exec(function (err,products) {     
           
          if (err){
              console.log(err);
          }else{
            num += 1;
            result.push(products[0]);
            if(num==number){
              res.render('continuing.ejs', { data: result,extract,user: req.user, page:page, maxPage:maxPage});
            }
          }
      });
      }
      if(number ==0){
        res.render('continuing.ejs', { data: result,extract,user: req.user, page:page, maxPage:maxPage});
      }
    }
  })})
})



// 계약서 검색 이후 휴지통에 있는 파일 클릭할 경우 contract2 파일 
app.get('/a/trashcan/:id',authenticateUser,(req,res)=>{
  Trashcan.find({ _id: req.params.id }, (err, products) => {
    res.render('contract2.ejs', { data: products,user: req.user , image_url : s3_image_url});
    
  });
});

// 휴지통에 있는 파일 클릭할 경우 contract2 파일 
app.get('/trashcan/:id',authenticateUser,(req,res)=>{
  Trashcan.find({ _id: req.params.id }, (err, products) => {
    res.render('contract2.ejs', { data: products,user: req.user , image_url : s3_image_url});
    
  });
});

//완료된 계약서 탭에서 계약서 검색 이후 계약서 상세페이지 들어가는 코드
app.get('/c/contracts/:id',authenticateUser,(req,res)=>{
  ExtractData.find({_id:req.params.id},(err,extract)=>{
    if(extract.length == 1){
      Detail.find({ _id: req.params.id }, (err, products) => {    
        res.render('contract4.ejs', { data: products ,extract,user: req.user, image_url : s3_image_url})
      });
    }else{
      // 계약서 추출하기 버튼을 누르지 않은 경우 이미지만 뜨는 contract2.ejs 파일임.
      Detail.find({ _id: req.params.id }, (err, products) => {
        res.render('contract2.ejs', { data: products ,user: req.user, image_url : s3_image_url});
        
      });
    }
  })
});

//진행중인 계약서 탭에서 계약서 검색 이후 계약서 상세페이지 들어가는 코드
app.get('/b/contracts/:id',authenticateUser,(req,res)=>{
  ExtractData.find({_id:req.params.id},(err,extract)=>{
    if(extract.length == 1){
      Detail.find({ _id: req.params.id }, (err, products) => {    
        res.render('contract4.ejs', { data: products ,extract,user: req.user, image_url : s3_image_url})
      });
      
    }else{
      // 계약서 추출하기 버튼을 누르지 않은 경우 이미지만 뜨는 contract2.ejs 파일임.
      Detail.find({ _id: req.params.id }, (err, products) => {
        res.render('contract2.ejs', { data: products ,user: req.user, image_url : s3_image_url});
        
      });
    }
  })
  
});

//휴지통에서 계약서 검색
app.get('/a/:keyword1',authenticateUser, (req, res) => {   
  var page = Math.max(1,req.query.page);
  var limit = 10;
    
  Trashcan.countDocuments({user:req.user.id},function(err,count){
    if(err) return res.json({success:false, message:err});
    var skip = (page-1)*limit;
    var maxPage = Math.ceil(count/limit);
  Trashcan.find({$and: [ { "title": { $regex: req.query.title }  }, {user:req.user.id } ] }).skip(skip).limit(limit).exec(function (err,products) {
      
      if(err) return res.json({success:false, message:err});
     
        res.render('trashcan.ejs', { data: products, page:page, maxPage:maxPage,user: req.user});
    });
});
});


//진행중인 계약서 탭에서 계약서 검색
app.get('/b/:keyword2',authenticateUser, (req, res) => {   
  var page = Math.max(1,req.query.page);
  var limit = 10;
  Detail.countDocuments({user:req.user.id},function(err,count){
    if(err) return res.json({success:false, message:err});
    var skip = (page-1)*limit;
    var maxPage = Math.ceil(count/limit);
  ExtractData.find({$and:[{user:req.user.id },{"endDate":{"$gt":today.toLocaleDateString()}}]}, function(err, extract) {
    if (err){
        console.log(err);
    }else{
      var number = extract.length;
      var result = new Array();
      var num = 0;
      for(var i=0; i < number; i++){
        Detail.find({"_id":{"$eq":extract[i]._id}}).skip(skip).limit(limit).exec(async function (err,products) {      
        let result1= await ExtractData.find({$and:[{user:req.user.id },{title:{$regex:req.query.title}},{"endDate":{"$gt":today.toLocaleDateString()}}]}) 
          if (err){
              console.log(err);
          }else{
            num += 1;
            result.push(products[0]);
            if(num==number){
              res.render('continuing.ejs', { data: result1,extract,user: req.user, page:page, maxPage:maxPage});
            }
          }
      });
      }                                                                                                                                                                                                                                                                                                                                                                                                                          

      if(number ==0){
        Detail.find({$and: [ { "title": { $regex: req.query.title }  }, {user:req.user.id } ] }).skip(skip).limit(limit).exec(function (err,products) {
        res.render('continuing.ejs', { data:  result1,extract,user: req.user, page:page, maxPage:maxPage});
      })
    }}
  })})
})

//완료된 계약서 탭에서 계약서 검색
app.get('/c/:keyword3',authenticateUser, (req, res) => {   
  var page = Math.max(1,req.query.page);
  var limit = 10;
  Detail.countDocuments({user:req.user.id},function(err,count){
    if(err) return res.json({success:false, message:err});
    var skip = (page-1)*limit;
    var maxPage = Math.ceil(count/limit);
ExtractData.find({$and:[{user:req.user.id },{"endDate":{"$lte":today.toLocaleDateString()}}]}, function(err, extract) {
  if (err){
      console.log(err);
  }else{
    var number = extract.length;
    var result = new Array();
    var num = 0;
    for(var i=0; i < number; i++){
      Detail.find({"_id":{"$eq":extract[i]._id}}).skip(skip).limit(limit).exec(async function (err,products) {      
      let result1= await ExtractData.find({$and:[{user:req.user.id },{title:{$regex:req.query.title}},{"endDate":{"$lte":today.toLocaleDateString()}}]}) 
        if (err){
            console.log(err);
        }else{
          num += 1;
          result.push(products[0]);
          if(num==number){
            res.render('expired.ejs', { data: result1,extract,user: req.user, page:page, maxPage:maxPage});
          }
        }
    });
    }                                                                                                                                                                                                                                                                                                                                                                                                                          

    if(number ==0){
      Detail.find({$and: [ { "title": { $regex: req.query.title }  }, {user:req.user.id } ] }).skip(skip).limit(limit).exec(function (err,products) {
      res.render('continuing.ejs', { data:  result1,extract,user: req.user, page:page, maxPage:maxPage});
    })
  }}

})})
})

//전체계약서 탭에서 계약서 검색
app.get('/:keyword',authenticateUser, (req, res) => {   
  var page = Math.max(1,req.query.page);
  var limit = 10;
    
  Detail.countDocuments({user:req.user.id},function(err,count){
    if(err) return res.json({success:false, message:err});
    var skip = (page-1)*limit;
    var maxPage = Math.ceil(count/limit);
    Detail.find({$and: [ { "title": { $regex: req.query.title }  }, {user:req.user.id } ] }).skip(skip).limit(limit).exec(function (err,products) {
      
      if(err) return res.json({success:false, message:err});
      ExtractData.find({},(err,extract)=>{
        res.render('contracts.ejs', { data: products,extract, page:page, maxPage:maxPage,user: req.user});
      })
  
    });
  });
});

app.set('port',3000);
//Checking mongodb connection
mongoose.connection.on('error', function(err) {
  console.log('Mongodb is not running.');
  process.exit();
}).on('connected', function() {
  server.listen(app.get('port'), function() {
      console.log('Server started at : http://localhost:' + app.get('port'));
  });
});
module.exports = app; 