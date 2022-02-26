// const express = require("express");
// const port = process.env.PORT || 5000;
// const app = express();
//
//
// app.get('/test', (req, res) => {
//     res.send("<h1>hello world</h1>");
// });
//
// app.listen(port, function () {
//   console.log(`server running now.. ${port}`);
// });

const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const port = process.env.PORT || 5000;
const cors = require("cors");
const app = express();

app.use(cors());

var get_options={
  method: 'GET',
  withCredentials: true,
  headers: {
    "User-Agent": "Mozilla/5.0",
  }
}

var post_options={
  method: 'POST',
  withCredentials: true,
  headers: {
    "User-Agent": "Mozilla/5.0",
  }
}

function line_generator(line_char, line_length){ //generate a line using a character and set the length
  var line=line_char;
  for(var i=0; i<line_length; i++) {
    line = line + line_char;
  }
  return line; //return the generated line
}

function tag_remover(str){
  if(str.search(/\</i) !== -1){
    while(str.search(/\</i) !== -1){
      var bracket_pos_1 = str.search(/\</i);
        var bracket_pos_2 = str.search(/\>/i);
        var str_remove = str.slice(bracket_pos_1, bracket_pos_2+1);
        str = str.replace(str_remove, '');
    }
  }
  return str;
}

//NYSE API

function nyse_get(keyWord, res){

  var url="https://www.nyse.com/api/quotes/filter";
  var payload={"instrumentType":"EQUITY","pageNumber":1,"sortColumn":"NORMALIZED_TICKER","sortOrder":"ASC","maxResultsPerPage":10,"filterToken":""};
  post_options.url=url;
  post_options.data=payload;

  return new Promise(function(resolve, reject){
    axios(post_options).then(function(response){
      var data=response.data;
      console.log(data);
      //retrieve the total number of entries
      var total=data[0].total;
      console.log(`total: ${total}`);
      //alter the payload so that all entries can be accessed
      payload["maxResultsPerPage"]=total;
    }).then(function(){
      //a HTTP POST request is required
      post_options.data=payload;
      axios(post_options).then(function(response){
        var data=response.data;
        for(var i=0; i<data.length; i++){
          //if the keyword entered by the user matches the company name or ticker
          if((data[i]["instrumentName"].toLowerCase().search(keyWord.toLowerCase()) !== -1) || (data[i]["symbolTicker"].toLowerCase().search(keyWord.toLowerCase()) !== -1)){
            console.log(data[i]);
            const ticker=data[i]["symbolTicker"];

            //this url is used to obtain the authentication key
            var td_url="https://www.nyse.com/api/idc/td";

            //to authenticate we must insert the key into the authentication url
            var authUrl_start="https://nyse.widgets.dataservices.theice.com/Login?auth=";
            var authUrl_end="&browser=false&client=mobile&callback=__gwt_jsonp__.P0.onSuccess";

            axios.get(td_url).then(function(response){
              var data=response.data;
              console.log(response.headers);
              var auth=data['td'].toString().split('=')[0];
              var search_chars=['/', '\\+'];
              console.log(auth);

              //the authentication key needs to be encoded before it can be used
              auth=encodeURIComponent(auth);

              console.log(`auth=${auth}`);
              //insert the encoded authentication key
              var auth_url=`${authUrl_start}${auth}${authUrl_end}`;
              console.log(`auth_url: ${auth_url}`);

              get_options.url=auth_url;

              axios(get_options).then(function(response){
                var data=response.data.toString();
                console.log(data);
                //obtain cbid
                var cbid=data.split('"cbid":')[1].split('"')[1];
                console.log(cbid);
                var search_chars=['/', '\\+'];
                //obtain session key
                var session_key=encodeURIComponent(data.split('"webserversession":')[1].split('"')[1].split(',')[1].split('=')[0], search_chars);
                console.log(session_key);

                let promises=[];

                var datasets=["MQ_Fundamentals", "DividendsHistory"];
                for(var i=0; i<datasets.length; i++){
                  console.log(`datasets=${datasets[i]}\n\n\n`);
                  promises.push(dataset_fetch(datasets[i], ticker, session_key, cbid));
                }

                promises.push(snapshot_get(ticker, session_key, cbid));

                Promise.all(promises).then(function(result){
                  console.log(result);
                  res.send(result);
                });

              });
            });
            break;
          }
          else if(keyWord.search("--l") !== -1){
            console.log(i);
            console.log(`${data[i]["instrumentName"]}`);
          }
        }
      });
    });
  });

}

function snapshot_get(ticker, session_key, cbid){
  return new Promise(function(resolve, reject){
    var url=`https://data2-widgets.dataservices.theice.com/snapshot?symbol=${ticker}&type=stock&username=nysecomwebsite&key=${session_key}&cbid=${cbid}`;
    get_options.url=url;
    axios(get_options).then(function(response){
      var body=response.data;
      var new_line_split=body.split('\n');

      var data_arr=[];
      for(var i=0; i<new_line_split.length; i++){
        if(new_line_split[i].search("=") !== -1){
          var dataObj=new Object();
          dataObj[new_line_split[i].split('=')[0]]=new_line_split[i].split('=')[1];
          data_arr.push(dataObj);
        }
      }
      console.log(data_arr);
      //res.send(data_arr);
      resolve(data_arr);
    });

  });
}

function dataset_fetch(dataset, ticker, session_key, cbid){
  return new Promise(function(resolve, reject){
    var dataUrl_start="https://data2-widgets.dataservices.theice.com/fsml?requestType=content&username=nysecomwebsite&key=";
    var dataUrl_end=`&dataset=${dataset}&fsmlParams=key%3D${ticker}&json=true`;

    var dataUrl=`${dataUrl_start}${session_key}&cbid=${cbid}${dataUrl_end}`;
    console.log(dataUrl);

    get_options.url=dataUrl;

    axios(get_options).then(function(response){
      var data=response.data;
      console.log(data);
      resolve(data);
    });
  });
}

//NASDAQ API

function nasdaq_get(keyWord, res){

  var msg_str="";
  const url = 'https://api.nasdaq.com/api/quote/list-type/nasdaq100';

  var options={
    url: url,
    proxy: {
      host: 'localhost',
      port: 3200
    },
  }

  var signal_Dict = {
    "+": 1,
    "-": 0
  };

  var title_Str="Command guide for accessing NASDAQ100 data";
  var help_Str = `${title_Str}\n${line_generator('-', title_Str.length-1)}\n\n
  1. To display the components of NASDAQ100: "nasdaq_get --l"\n
  2. To display data associated with a specific company: "nasdaq_get --kw(TICKER OR COMPANY Name)"\n
  3. To display market info: "nasdaq_get --market-info"\n`;

  if(keyWord.search('--l') !== -1){
    console.log("listing!!!");
    axios(options).then(function(response){
      var body=response.data;
      //console.log(body);
      var date_str=`Time Stamp: ${body.data['date']}`;
      var stock_recs=body.data.data.rows;
      //console.log(stock_recs);
      msg_str = msg_str + `Components of NASDAQ100\n${date_str}\n${line_generator('-', date_str.length-1)}\n\n`;
      Object.keys(stock_recs).forEach(function(key) {
        //console.log(key);
        var companyName = stock_recs[key].companyName.toString();
        var symbol = stock_recs[key].symbol.toUpperCase();
        msg_str = msg_str + `Symbol: ${symbol}, Name: ${companyName}\n\n`;
      });
      console.log(msg_str);
    }).catch(function(err){
      console.log(err);
    });
  }
  else if(keyWord.toLowerCase().search("help") !== -1){
    console.log(help_Str);
    res.send(help_Str);
  }
  else if(keyWord.toLowerCase().search("market-info") !== -1){
    axios.get("https://api.nasdaq.com/api/market-info").then(function(response){
      var body=response.data;
      //console.log(body.data);
      res.send(body);
      var info_str="";
      Object.keys(body.data).forEach(function(el, idx){
          //console.log(`${el}: ${body.data[el]}`);
          info_str=info_str+`${el}: ${body.data[el]}\n`
      });
      info_str=`${line_generator('*', 50)}\n\n${info_str}`;
      console.log(info_str);
      //res.send(info_str);
    })
    // res.send("logic working...");
  }
  else{
    axios(options).then(function(response){
      var body=response.data;
      var date=body.data['date'];
      var stock_recs=body.data.data.rows;
      msg_str = msg_str + `Time Stamp: ${date}\n`;
      Object.keys(stock_recs).forEach(function(key) {
        var companyName = stock_recs[key].companyName.toString();
        var symbol = stock_recs[key].symbol.toUpperCase();
        if(((companyName.toLowerCase().search(keyWord.toLowerCase()) !== -1) || (symbol.toLowerCase().search(keyWord.toLowerCase()) !== -1)) && (typeof keyWord !== 'undefined')){

          var marketCap = stock_recs[key].marketCap;
          var last = stock_recs[key].lastSalePrice;
          var netChange = stock_recs[key].netChange;
          var percenChange = stock_recs[key].percentageChange;
          msg_str=`${line_generator('*', 50)}\n\nSource: ${url}\n\nSymbol: ${symbol}\n\nName: ${companyName}\n\nMarket Cap: ${marketCap}\n\nLast sale price: ${last}\n\nNet change: ${netChange}\n\nPercentage change: ${percenChange}`;
          console.log(msg_str);
          var textObj={
            text: msg_str
          };
          return false;
        }
      });
    });
  }
}

async function serverSetUp(){
  //set up a proxy server to pass requests through to avoid forbidden 403 error
  const proxyServer = httpProxy.createProxyServer({});
  const app = express();
  //app.get is used to handle GET requests, app.post is used to handle POST requests

  app.get('*', function(req, res) {
    console.log(`protocol=${req.protocol}, hostname=${req.hostname}`);
    console.log(`${req.protocol}://${req.hostname}`);
    proxyServer.web(req, res, { target: `${req.protocol}://${req.hostname}` });
  });
  //use port 3200
  const server = await app.listen(3200);
}

app.use(bodyParser.urlencoded({ extended: false }));

// app.get("/api1", (req, res) => {
//   console.log(`localhost:${port} api is running`);
//   const data = {
//     result: `Success! from localhost on localhost:${port}!!`,
//   };
//   //res.send(data);
//   // axios.get("https://www.nyse.com/api/idc/td").then(function(response){
//   //   console.log(response.data);
//   // })
//   nyse_get("tsla", res);
//
// });

serverSetUp();

app.get("/test", (req, res) => {
  res.send("test");
});

app.post("/nasdaq", (req, res) => {
  console.log(req.body.keyWord);
  //res.send(req.body.keyWord);
  nasdaq_get(req.body.keyWord, res);
});

app.post("/nyse", (req, res) => {
  console.log(req.body.keyWord);
  nyse_get(req.body.keyWord, res);
});

app.listen(port, function () {
  console.log(`server running now.. ${port}`);
});
