const express = require('express');
const server = express();
const {db} = require('./firebase.js');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

var bodyParser = require('body-parser');
server.use(bodyParser.urlencoded({extended: true}));
server.use(bodyParser.json());

// Add headers
server.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

server.post('/blog', async (req, res) => {
    const blog = req.body;
    try {
    await db.collection('blogs').add({
        authorId: blog.userId,
        authorUsername: blog.username,
        title: blog.title,
        content: blog.content,
        image: blog.image || null,
        time: blog.time,
        difficulty: blog.difficulty,
        views: 0,
        token: blog.token,
        createdAt: new Date()
    })
    res.sendStatus(200);
  } catch (err) {
    res.statusCode = 500;
    res.end("Values are null or not valid");
  }
});

server.get('/blogs', async (req, res) => {
    try {
        const blogs = await db.collection('blogs').orderBy("createdAt", 'desc').get()
        const blogArray = []
        blogs.forEach(async (blog) => {
          const blogData = blog.data();
            const data = {
              title: blogData.title,
              authorUsername: blogData.authorUsername,
              createdAt: blogData.createdAt,
              image: blogData.image,
              time: blogData.time,
              difficulty: blogData.difficulty,
              views: blogData.views
            };
            data.id = blog.id;
            blogArray.push(data);
          })
        res.send(blogArray)
    } catch (err) {
      console.error(err)
      res.sendStatus(500)
    }
})
  

server.get('/blog', async (req, res) => {
    try {
      const id = req.query.id;
      const blog = await db.collection('blogs').doc(id).get();
      const isOwner = blog.data().token === req.query.token;
      const blogData = {...blog.data(), token: null, isOwner: isOwner, views: 1 + blog.data().views}
      await db.collection('blogs').doc(id).update({views: blogData.views});
      res.send(blogData)
    } catch (err) {
      console.error(err)
      res.sendStatus(500)
    }
})

server.delete('/blog', async (req, res) => {
  try {
    const id = req.body.id;
    const blog = await db.collection('blogs').doc(id).get();
    if(blog.data().token === req.body.token) {
      await db.collection('blogs').doc(id).delete();
      res.send("Success")
    }
    else
      res.status(500).send("wrong token")
  } catch (err) {
    console.error(err)
    res.sendStatus(500)
  }
})

server.post('/signup', async (req, res) => {
  try {

    let repeatedUsername, repeatedEmail = false
    //VERIFY IF THERE IS A USER 
    const usersName = await db.collection('users').where('username', '==', req.body.username).get();
    usersName.forEach(() => {
      repeatedUsername = true
    });
    const usersEmail = await db.collection('users').where('email', '==', req.body.email).get();
    usersEmail.forEach(() => {
      repeatedEmail = true
    });
    
    if (repeatedUsername) {
      res.send("USERNAME_REPEATED");
      return;
    } else if (repeatedEmail) {
      res.send("EMAIL_REPEATED");
      return;
    }

    //ENCRYPT PASSWORD AND ADD USER
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(req.body.password, salt);
    const token = crypto.randomBytes(16).toString('hex');
    await db.collection('users').add({
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword,
      token: token
    }).catch((err) => 
      res.sendStatus(500).send("Values are null or undefined")
    )

    //LOGIN
    const users = await db.collection('users').where('username', '==', req.body.username).get();
    var user;
    users.forEach(userA => {
      user = userA.data();
      user.id = userA.id;
    })
    if(user == null) {
      res.sendStatus(400).send("Cannot find user with that username");
    }

    //SEND USER BACK
    res.send({
      username: user.username,
      email: user.email,
      user: user.id,
      token: user.token
    });
  } catch (err) {
    console.error(err)
    res.sendStatus(500)
  }
});

server.post('/login', async (req, res) => {
  const users = await db.collection('users').where('username', '==', req.body.username).get();
  var user;
  users.forEach(userA => {
    user = userA.data();
    user.id = userA.id;
  })
  if(user == null) {
    res.status(400).send("Cannot find user with that username");
  }
  try {
    if(await bcrypt.compare(req.body.password, user.password)) {
      res.send({
        username: user.username,
        email: user.email,
        userId: user.id,
        token: user.token
      });
    } else {
      res.status(400).send("Wrong Password");
    }
  } catch {
    res.status(500);
  }
})

server.post('/loginToken', async (req, res) => {
  const users = await db.collection('users').where('username', '==', req.body.username).get();
  var user;
  users.forEach(userA => {
    user = userA.data();
    user.id = userA.id;
  })
  if(user == null) {
    res.status(400).send("Cannot find user with that username");
  }
  try {
    if(req.body.token === user.token) {
      res.send({
        username: user.username,
        email: user.email,
        userId: user.id,
        token: user.token
      });
    } else {
      res.status(400).send("Wrong Token");
    }
  } catch {
    res.status(500);
  }
})

const port = process.env.PORT || 5000;

server.listen(port, () => {
  console.log(port);
});