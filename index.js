const express = require("express");
const port = process.env.PORT || 5000;
const app = express();


app.get('/test', (req, res) => {
    res.send("<h1>hello world</h1>");
});

app.listen(port, function () {
  console.log(`server running now.. ${port}`);
});
