var mongoose = require('mongoose');
var Schema = mongoose.Schema;

trashcanSchema = new Schema( {
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
Trashcan = mongoose.model('Trashcan', trashcanSchema);
module.exports = Trashcan;

