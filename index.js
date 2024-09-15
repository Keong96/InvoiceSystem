const express = require("express");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require('cors')
const app = express();
const PORT = process.env.PORT || 8081;
const crypto = require("crypto");
require('dotenv').config();

const config = {
  connectionString:
    "postgresql://invoice_system_db_nasg_user:p6loAUMz3AR1a434tI2113dQ4udYDMOG@dpg-crjk29m8ii6s73fh9720-a.singapore-postgres.render.com/invoice_system_db_nasg?ssl=true",
};

const { Client } = require('pg');
const { constants } = require("buffer");
const client = new Client(config);
client.connect()

app.use(cors())
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false, parameterLimit:50000 }));

app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});


function GenerateJWT(_userId, _username, _user_type)
{
  return jwt.sign(
      { userId: _userId, username: _username, user_type: _user_type},
      process.env.TOKEN_KEY,
      { expiresIn: "24h" }
    );
}

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (authHeader) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.TOKEN_KEY, (err, user) =>
    {
      if (err)
      {
        return res.sendStatus(403);
      }

      req.user = user;
      next();
    });
  }
  else
  {
    res.sendStatus(401);
  }
}

app.get('/', async (req, res) => {
  res.status(200).send("OK");
})

app.post('/login', async (req, res) => {

  if( typeof(req.body.username) == 'undefined' || typeof(req.body.password) == 'undefined')
  {
    return res.status(200).json(
    {
      status: false,
      data: {},
      message: "Error: Please enter your username and password to login.",
    });
  }

  client.query("SELECT * FROM users WHERE username = $1 AND password = crypt($2, password)", [req.body.username, req.body.password])
  .then((result) => {
    if(result.rows.length > 0)
    {
      const token = GenerateJWT(result.rows[0].id, result.rows[0].username, result.rows[0].user_type);

      client.query("UPDATE users SET last_login = NOW() WHERE id = $1", [result.rows[0].id])

      res.status(200).json({
        success: true,
        data: {
          userId: result.rows[0].id,
          token: token,
        },
        message: ""
      });
    }
    else
    {
      return res.status(200).json(
      {
        status: false,
        data: {},
        message: "Error: Wrong Username or Password",
      });
    }
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  })
})

app.get('/profile', verifyToken, async (req, res) => {

  client.query("SELECT * FROM users WHERE id = $1", [req.user.userId])
  .then((result) => {
    return res.status(200).json(
    {
      status: true,
      data: {
        username: result.rows[0].username,
        role: result.rows[0].role,
      },
      message: "Success",
    });
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  })
})

app.get('/user', verifyToken, async (req, res) => {

  client.query("SELECT * FROM users")
  .then((result) => {
    return res.status(200).json(
    {
      status: true,
      data: result.rows,
      message: "Success",
    });
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  })
})

app.post('/user', verifyToken, async (req, res) => {

  if( typeof(req.body.username) == 'undefined' || typeof(req.body.password) == 'undefined')
  {
    return res.status(200).json(
    {
      status: false,
      data: {},
      message: "Error: Please fill in your username and password to complete the registration process.",
    });
  }

  client.query("SELECT * FROM users WHERE username = $1", [req.body.username])
  .then((result) => {
      if(result.rows.length > 0)
      {
        if(req.body.username == result.rows[0].username)
          return res.status(200).json(
          {
            status: false,
            data: {},
            message: "Error: username has been taken",
          });
      }
      else
      {
        client.query("INSERT INTO users (username, password) VALUES ($1, crypt($2, gen_salt('bf')))", [req.body.username, req.body.password])
        .then((result) => {
          res.json(
            {
              status: true,
              data: {},
              message: "Success",
            }
          );
        })
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send(e.stack);
        })
      }
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  })
})

app.get('/customer', verifyToken, async (req, res) => {

  let params = [];
  let query = "SELECT * FROM customers";

  if(req.params.id)
  {
    params.push(req.params.id)
    query += " WHERE id = $1";
  }

  client.query(query, params)
  .then((result) => {
    return res.status(200).json(
    {
      status: true,
      data: result.rows,
      message: "Success",
    });
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  })
})

app.post('/customer', verifyToken, async (req, res) => {

  if( typeof(req.body.name) == 'undefined' || typeof(req.body.address) == 'undefined' || typeof(req.body.tel) == 'undefined')
  {
    return res.status(200).json(
    {
      status: false,
      data: {},
      message: "Error: Please fill in name, address and tel to complete the process.",
    });
  }
    
  client.query("INSERT INTO customers (customer_name, address, tel, created_by) VALUES ($1, $2, $3, $4)", [req.body.name, req.body.address, req.body.tel, req.user.userId])
  .then(() => {
    res.json(
      {
        status: true,
        data: {},
        message: "Success",
      }
    );
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  })
})

app.put('/customer', verifyToken, async (req, res) => {
  if( typeof(req.body.customerId) == 'undefined' || typeof(req.body.name) == 'undefined' || typeof(req.body.address) == 'undefined' || typeof(req.body.tel) == 'undefined')
  {
    return res.status(200).json(
    {
      status: false,
      data: {},
      message: "Error: Please fill in name, address and tel to complete the process.",
    });
  }

  client.query("UPDATE customers SET customer_name = $1, address = $2, tel = $3 WHERE id = $4", [req.body.name, req.body.address, req.body.tel, req.body.customerId])
  .then(() => {
    res.json(
      {
        status: true,
        data: {},
        message: "Success",
      }
    );
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  })
})

//#region Invoice
app.get('/invoice/', verifyToken, async (req, res) => {

  let params = [];
  let query = "SELECT * FROM invoices WHERE 1=1";

  if(req.params.id)
  {
    params.push(req.params.id)
    query += ` AND id = $${params.length}`
  }

  if(req.params.customerId)
  {
    params.push(req.params.customerId)
    query += ` AND recipient = $${params.length}`;
  }

  client.query(query, params)
  .then((result) => {
    return res.status(200).json(
    {
      status: true,
      data: result.rows,
      message: "Success",
    });
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  })
})

app.post('/invoice', verifyToken, async (req, res) => {

  if( typeof(req.body.recipient) == 'undefined' || typeof(req.body.item_list) == 'undefined')
  {
    return res.status(200).json(
    {
      status: false,
      data: {},
      message: "Error: Please fill in recipient, item list to complete the registration process.",
    });
  }

  let invoiceHeader = await client.query("SELECT * FROM settings WHERE key = $1", ["invoice_header"]);
  let invoiceNo = await client.query("SELECT * FROM settings WHERE key = $1", ["invoice_no"]);

  let newInvoiceNo = invoiceHeader+""+(invoiceNo+1);
  client.query("INSERT INTO invoices (invoice_no, recipient, item_list) VALUES ($1, $2, $3)", [newInvoiceNo, req.body.recipient, req.body.item_list])
  .then(() => {
    return res.status(200).json(
      {
        status: true,
        data: {},
        message: "Invoice Created",
      });
  })
  .catch((e) => {
      console.error(e.stack);
      res.status(500).send(e.stack);
  })
});

app.put('/invoice/', verifyToken, async (req, res) => {
  
  client.query("UPDATE invoices SET recipient = $1, item_list = $2, WHERE id = $", [req.body.recipient, req.body.item_list, result.body.id])
  .then(() => {
    return res.status(200).json(
    {
      status: true,
      data: {},
      message: "Invoice Update Success"
    });
  })
  .catch((e) => {
      console.error(e.stack);
      res.status(500).send(e.stack);
  })
});
//#endregion