var mongoose = require('mongoose');
var Schema = mongoose.Schema;

extractDataSchema = new Schema( {
    unique_id:Number,
    user:String,
    title:String,  
   startDate:String,   
   startDatePosition:Array,
   endDate:String,
   endDatePosition:Array,
   contractDate:String,
   deposit:String,
   secondPayment:String,
   balance:String,
   downPayment:String,
   downPaymentPosition:Array, 
   startrisk: String,
   endrisk:  String,
   dayrisk:  String,
   depositrisk:  String,
   secondPaymentrisk:  String,
   balencerisk:  String,
   moneyrisk:  String,
   
   startreference:  String,
   endreference:  String,
   dayreference:  String,
   depositreference: String,
   secondPaymentreference:  String,
   balencereference: String,
   moneyreference: String,

   risk: String,

  
  
	added_date:{
		type: Date,
		default: Date.now
	}	

}),
ExtractData = mongoose.model('ExtractData', extractDataSchema);
module.exports = ExtractData;

