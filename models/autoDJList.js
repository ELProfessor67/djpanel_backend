const mongoose = require("mongoose");
const userSchema = require("./user");
const songSchema = require('./song');

const autoDJListSchema = new mongoose.Schema({
    owner: {type: mongoose.Schema.Types.ObjectId,ref: userSchema},
    songs: [
        {
            data: {type: mongoose.Schema.Types.ObjectId,ref: songSchema},
            cover: {type: String, default: undefined},
            index: {type: Number,default: 0}

        }
    ],
},{timestamps: true});



module.exports =  mongoose.model('auto_dj_list',autoDJListSchema);