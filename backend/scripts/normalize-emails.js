const mongoose = require('mongoose');
const User = require('../users/users.model');

const normalizeEmails = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');
    
    const users = await User.find({});
    console.log(`Found ${users.length} users`);
    
    let updated = 0;
    let duplicates = [];
    
    for (const user of users) {
      const normalizedEmail = user.email.toLowerCase().trim();
      
      // Check if this would create a duplicate
      const existingUser = await User.findOne({ 
        email: normalizedEmail,
        _id: { $ne: user._id }
      });
      
      if (existingUser) {
        console.log(`Duplicate found: ${user.email} -> ${normalizedEmail}`);
        duplicates.push({
          keep: existingUser._id,
          remove: user._id,
          email: normalizedEmail
        });
        continue;
      }
      
      if (user.email !== normalizedEmail) {
        await User.updateOne(
          { _id: user._id },
          { $set: { email: normalizedEmail } }
        );
        console.log(`Updated: ${user.email} -> ${normalizedEmail}`);
        updated++;
      }
    }
    
    console.log(`\nUpdated ${updated} users`);
    console.log(`Found ${duplicates.length} duplicates that need manual handling`);
    
    if (duplicates.length > 0) {
      console.log('\nDuplicate users:', duplicates);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

normalizeEmails();