// backend/colleges/colleges.model.js
const mongoose = require('mongoose');

const collegeSchema = new mongoose.Schema({
  name:             { type: String, required: true, trim: true },
  short:            { type: String, default: '', trim: true },
  city:             { type: String, default: 'Bengaluru', trim: true },
  status:           { type: String, enum: ['approved', 'pending'], default: 'approved' },
  requestedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requestedByName:  { type: String, default: '' },
  requestedByEmail: { type: String, default: '' },
  rawRequestedName: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('College', collegeSchema);
