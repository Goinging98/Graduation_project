var mongoose = require('mongoose');
var Schema = mongoose.Schema;

detailSchema = new Schema( {
	unique_id:Number,
	user:String,
   title:String,  
   pdf_name:String, 
   image2:Array,
   image3:Array,
        
  
  
	added_date:{
		type: Date,
		default: Date.now
	}	

}),
Detail = mongoose.model('Detail', detailSchema);
module.exports = Detail;

