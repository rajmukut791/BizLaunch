const mongoose = require('mongoose');
module.exports = async () => {
  const connection = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log(
    'MongoDB Connected: ' + connection.connection.host + '/' + connection.connection.name,
  );
  // Ensure uniqueness constraints are ready before serving traffic.
  const User = require('../models/User');
  const models = require('../models/commerce');
  await Promise.all([User.init(), ...Object.values(models).map((model) => model.init())]);
};
