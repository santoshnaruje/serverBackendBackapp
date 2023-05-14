const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const cors = require("cors");

let db = null;
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "Bank.db");

const initialize = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    await db.run(`CREATE TABLE IF NOT EXISTS usertable (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        password TEXT NOT NULL,
        accountNumber INTEGER NOT NULL,
        balance REAL NOT NULL DEFAULT 0.0
      )`);
    await db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        senderAccountNumber INTEGER NOT NULL,
        receiverAccountNumber INTEGER NOT NULL,
        username TEXT NOT NULL,
        amount REAL NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
    app.listen(5000, () => {
      console.log("server started");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
  }
};

initialize();

app.use(
  cors({
    origin: "*",
  })
);

app.use(
  cors({
    methods: ["GET", "POST", "DELETE", "UPDATE", "PUT", "PATCH"],
  })
);

app.get("/delete",async(req,res)=>{
    const sql1=`DELETE FROM usertable`;
   const sql2=`DELETE FROM transactions`;
   await db.run(sql1)
   await db.run(sql2)
   res.send("deleted")
})

app.get('/users', async (req, res) => {
const sql = `SELECT * FROM usertable `;
  const users = await db.all(sql);
  res.status(200).json(users);
});

app.get('/user/:username', async (req, res) => {
    
    const sql = `SELECT * FROM usertable where username='${req.params.username}'`;
      const users = await db.get(sql);
      res.status(200).json(users);
    });

app.post('/register', async (req, res) => {
  console.log("called")
  const { username, email, password, accountNumber } = req.body;
  const sql = `INSERT INTO usertable (username, email, password, accountNumber) 
                 VALUES ('${username}', '${email}', '${password}', '${accountNumber}');`;
  await db.run(sql)
  res.send("added succesfully")
});

app.post('/login', async (req, res) => {
  const { accountNumber, password } = req.body;

  const userQuery = `SELECT * FROM usertable WHERE accountNumber = '${accountNumber}' or password = '${password}'`;
  const user = await db.get(userQuery);

  if (!user) {
    res.status(401).send('Invalid credentials.');
    return;
  }

  res.status(200).send('Login successful.');
});

app.put('/deposit/:accountNumber', async (req, res) => {

  const { amount } = req.body;
  console.log("called")
  const sql = `UPDATE usertable SET balance = balance + ${amount} WHERE accountNumber = '${req.params.accountNumber}'`;
  const playerQuery = await db.run(sql)
  await db.run(`INSERT INTO transactions (senderAccountNumber, receiverAccountNumber, amount) 
                 VALUES (${req.params.accountNumber}, ${req.params.accountNumber}, ${amount});`);
  res.status(200).send("Depositted Successfully")
});

app.put('/withdraw/:accountNumber', async (req, res) => {
  
  const { amount } = req.body;
  console.log("called")

  const accountQuery = `SELECT * FROM usertable WHERE accountNumber = '${req.params.accountNumber}'`;
  const account = await db.get(accountQuery);
  if (!account) {
    res.status(401).send('Invalid account number.');
    return;
  }

  if (account.balanceis < amount) {
    res.status(401).send('Insufficient balance.');
    return;
  }

  const sql = `UPDATE usertable SET balance = balance - ${amount} WHERE accountNumber = '${req.params.accountNumber}'`;
  await db.run(sql)
  await db.run(`INSERT INTO transactions (senderAccountNumber, receiverAccountNumber, amount) 
                 VALUES (${req.params.accountNumber}, ${req.params.accountNumber}, -${amount});`);
  res.send("Withdrawn Successfully")
});

app.get('/transactions/:username', async (req, res) => {
  

  const sql = `SELECT * FROM transactions 
               WHERE senderAccountNumber = ${req.params.username} OR receiverAccountNumber = ${req.params.username};`;
  const transactions = await db.all(sql);
console.log(transactions)
  res.status(200).json(transactions);
});
app.post('/transfer', async (req, res) => {
  const { senderAccountNumber, receiverAccountNumber, amount } = req.body;

  const senderQuery = `SELECT * FROM usertable WHERE accountNumber = '${senderAccountNumber}'`;
  const sender = await db.get(senderQuery);

  if (!sender) {
    res.status(401).send('Sender account number is invalid.');
    return;
  }

  if (sender.balance < amount) {
    res.status(401).send('Insufficient balance.');
    return;
  }

  const receiverQuery = `SELECT * FROM usertable WHERE accountNumber = '${receiverAccountNumber}'`;
  const receiver = await db.get(receiverQuery);

  if (!receiver) {
    res.status(401).send('Receiver account number is invalid.');
    return;
  }

  await db.run(`UPDATE usertable SET balance = balance - ${amount} WHERE accountNumber = '${senderAccountNumber}'`);
  await db.run(`UPDATE usertable SET balance = balance + ${amount} WHERE accountNumber = '${receiverAccountNumber}'`);

  await db.run(`INSERT INTO transactions (senderAccountNumber, receiverAccountNumber, amount) 
                 VALUES (${senderAccountNumber}, ${receiverAccountNumber}, -${amount});`);
  await db.run(`INSERT INTO transactions (senderAccountNumber, receiverAccountNumber, amount) 
                 VALUES (${senderAccountNumber}, ${receiverAccountNumber}, ${amount});`);

  res.send("Transfer Successful");
});

