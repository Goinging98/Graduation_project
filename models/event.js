var mongoose = require('mongoose');
var Schema = mongoose.Schema;
//Event Schema
eventSchema = new Schema({
    user:{type: String},
    start_date: {type: Date},
    end_date: {type: Date},
    text: {type: String},
    id: {type: String}
});
EventSchema = mongoose.model('EventSchema', eventSchema);
module.exports = EventSchema;


