const mongoose = require('mongoose')

const ideaSchema = new mongoose.Schema({
    title: {
        type: String,
        require: true
    },
    author: {
        type: mongoose.SchemaTypes.ObjectId,
        require: true
    },
    created: {
        type: String,
        require: true
    },
    modified: {
        type: String,
        require: true
    },
    label: {
        type: String,
        require: true,
        default: 'Idea'
    },
    categories: {
        type: [String],
        require: true
    },
    content: {
        type: String,
        require: true
    },
    thumbnail: {
        type: Buffer
    },
    thumbnail_desc: {
        type: String
    },
    like: {
        type: Number,
        require: true,
        default: 0
    },
    views: {
        type: Number,
        require: true,
        default: 0
    }
})



module.exports = mongoose.model('idea', ideaSchema)