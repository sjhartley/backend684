const express = require("express");
const port = 5000;
const app = express();


app.use(cors());


app.get('/', (req, res) => {
    res.send("<h1>hello world</h1>");
});

app.listen(port, function () {
  console.log(`server running now.. ${port}`);
});
