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

var get_options = {
  method: "GET",
  withCredentials: true,
  headers: {
    "User-Agent": "Mozilla/5.0",
  },
};

var post_options = {
  method: "POST",
  withCredentials: true,
  headers: {
    "User-Agent": "Mozilla/5.0",
  },
};

function line_generator(line_char, line_length) {
  //generate a line using a character and set the length
  var line = line_char;
  for (var i = 0; i < line_length; i++) {
    line = line + line_char;
  }
  return line; //return the generated line
}

function tag_remover(str) {
  if (str.search(/\</i) !== -1) {
    while (str.search(/\</i) !== -1) {
      var bracket_pos_1 = str.search(/\</i);
      var bracket_pos_2 = str.search(/\>/i);
      var str_remove = str.slice(bracket_pos_1, bracket_pos_2 + 1);
      str = str.replace(str_remove, "");
    }
  }
  return str;
}

//NYSE API

function nyse_get(params, res) {
  console.log(params);
  let keyWord = params.keyWord;
  let mode = params.mode;
  let resultFilter = params.filter;

  var url = "https://www.nyse.com/api/quotes/filter";
  var payload = {
    instrumentType: "EQUITY",
    pageNumber: 1,
    sortColumn: "NORMALIZED_TICKER",
    sortOrder: "ASC",
    maxResultsPerPage: 10,
    filterToken: "",
  };
  post_options.url = url;
  post_options.data = payload;
  return new Promise(function (resolve, reject) {
    axios(post_options)
      .then(function (response) {
        var data = response.data;
        console.log(data);
        //retrieve the total number of entries
        var total = data[0].total;
        console.log(`total: ${total}`);
        //alter the payload so that all entries can be accessed
        payload["maxResultsPerPage"] = total;
      })
      .then(function () {
        //a HTTP POST request is required
        post_options.data = payload;
        axios(post_options).then(function (response) {
          var data = response.data;
          var list = [];
          for (var i = 0; i < data.length; i++) {
            //if the keyword entered by the user matches the company name or ticker

            let search = -1;
            let tickerSearch_includes = data[i]["symbolTicker"]
              .toLowerCase()
              .search(keyWord.toLowerCase());
            let nameSearch_includes = data[i]["instrumentName"]
              .toLowerCase()
              .search(keyWord.toLowerCase());
            let tickerSearch_equals =
              keyWord.toLowerCase() === data[i]["symbolTicker"].toLowerCase();
            let nameSearch_equals =
              keyWord.toLowerCase() === data[i]["instrumentName"].toLowerCase();

            if (mode === "ticker") {
              if (resultFilter === "equals" && tickerSearch_equals) {
                search = 1;
              } else if (resultFilter === "including") {
                search = tickerSearch_includes;
              }
            } else if (mode === "name") {
              if (resultFilter === "equals" && nameSearch_equals) {
                search = 1;
              } else if (resultFilter === "including") {
                search = nameSearch_includes;
              }
            } else if (mode === "ticker/name") {
              if (resultFilter === "equals") {
                if (tickerSearch_equals) {
                  search = 1;
                } else if (nameSearch_equals) {
                  search = 1;
                }
              } else if (resultFilter === "including") {
                if (tickerSearch_includes !== -1) {
                  search = tickerSearch_includes;
                } else if (nameSearch_includes !== -1) {
                  search = nameSearch_includes;
                }
              }
            }

            if (search !== -1) {
              console.log(data[i]);
              const ticker = data[i]["symbolTicker"];

              //this url is used to obtain the authentication key
              var td_url = "https://www.nyse.com/api/idc/td";

              //to authenticate we must insert the key into the authentication url
              var authUrl_start =
                "https://nyse.widgets.dataservices.theice.com/Login?auth=";
              var authUrl_end =
                "&browser=false&client=mobile&callback=__gwt_jsonp__.P0.onSuccess";

              axios
                .get(td_url)
                .then(function (response) {
                  var data = response.data;
                  console.log(response.headers);
                  var auth = data["td"].toString().split("=")[0];
                  var search_chars = ["/", "\\+"];
                  console.log(auth);

                  //the authentication key needs to be encoded before it can be used
                  auth = encodeURIComponent(auth);

                  console.log(`auth=${auth}`);
                  //insert the encoded authentication key
                  var auth_url = `${authUrl_start}${auth}${authUrl_end}`;
                  console.log(`auth_url: ${auth_url}`);

                  get_options.url = auth_url;

                  axios(get_options)
                    .then(function (response) {
                      var data = response.data.toString();
                      console.log(data);
                      //obtain cbid
                      var cbid = data.split('"cbid":')[1].split('"')[1];
                      console.log(cbid);
                      var search_chars = ["/", "\\+"];
                      //obtain session key
                      var session_key = encodeURIComponent(
                        data
                          .split('"webserversession":')[1]
                          .split('"')[1]
                          .split(",")[1]
                          .split("=")[0],
                        search_chars,
                      );
                      console.log(session_key);

                      let promises = [];

                      // var datasets=["MQ_Fundamentals", "DividendsHistory"];
                      // for(var i=0; i<datasets.length; i++){
                      //   console.log(`datasets=${datasets[i]}\n\n\n`);
                      //   promises.push(dataset_fetch(datasets[i], ticker, session_key, cbid));
                      // }

                      promises.push(snapshot_get(ticker, session_key, cbid));

                      Promise.all(promises).then(function (result) {
                        console.log(result);
                        res.send(result);
                      });
                    })
                    .catch(function (err) {
                      res.send([false, false, false]);
                      return false;
                    });
                })
                .catch(function (err) {
                  res.send([false, false, false]);
                  return false;
                });
              break;
            } else if (
              keyWord.search("--l") !== -1 &&
              keyWord.search("--all") !== -1
            ) {
              console.log(i);
              console.log(`${data[i]["instrumentName"]}`);
              let dataObj = new Object();
              //dataobj[""]
              //if(keyWord.search("--all") !== -1){
              //res.send("--all");
              // list.push({"ticker": data[i]["symbolTicker"], "last": data[i]["last"]});
              // if(i === data.length - 1){
              //   res.send(list);
              // }
              //}
            } else if (search === -1 && i === data.length - 1) {
              res.send([false, false, false]);
              console.log("NO MATCH...");
            }
          }
        });
      })
      .catch(function (err) {
        res.send([false, false, false]);
      });
  });
}

// function nyse_get(keyWord, res){
//
//   var url="https://www.nyse.com/api/quotes/filter";
//   var payload={"instrumentType":"EQUITY","pageNumber":1,"sortColumn":"NORMALIZED_TICKER","sortOrder":"ASC","maxResultsPerPage":10,"filterToken":""};
//   post_options.url=url;
//   post_options.data=payload;
//   return new Promise(function(resolve, reject){
//     axios(post_options).then(function(response){
//       var data=response.data;
//       console.log(data);
//       //retrieve the total number of entries
//       var total=data[0].total;
//       console.log(`total: ${total}`);
//       //alter the payload so that all entries can be accessed
//       payload["maxResultsPerPage"]=total;
//     }).then(function(){
//       //a HTTP POST request is required
//       post_options.data=payload;
//       axios(post_options).then(function(response){
//         var data=response.data;
//         var list=[];
//         for(var i=0; i<data.length; i++){
//           //if the keyword entered by the user matches the company name or ticker
//
//           let tickerSearch=data[i]["symbolTicker"].toLowerCase().search(keyWord.toLowerCase());
//           let nameSearch=data[i]["instrumentName"].toLowerCase().search(keyWord.toLowerCase());
//
//
//           if((tickerSearch !== -1) || (nameSearch !== -1)){
//             console.log(data[i]);
//             const ticker=data[i]["symbolTicker"];
//
//             //this url is used to obtain the authentication key
//             var td_url="https://www.nyse.com/api/idc/td";
//
//             //to authenticate we must insert the key into the authentication url
//             var authUrl_start="https://nyse.widgets.dataservices.theice.com/Login?auth=";
//             var authUrl_end="&browser=false&client=mobile&callback=__gwt_jsonp__.P0.onSuccess";
//
//             axios.get(td_url).then(function(response){
//               var data=response.data;
//               console.log(response.headers);
//               var auth=data['td'].toString().split('=')[0];
//               var search_chars=['/', '\\+'];
//               console.log(auth);
//
//               //the authentication key needs to be encoded before it can be used
//               auth=encodeURIComponent(auth);
//
//               console.log(`auth=${auth}`);
//               //insert the encoded authentication key
//               var auth_url=`${authUrl_start}${auth}${authUrl_end}`;
//               console.log(`auth_url: ${auth_url}`);
//
//               get_options.url=auth_url;
//
//               axios(get_options).then(function(response){
//                 var data=response.data.toString();
//                 console.log(data);
//                 //obtain cbid
//                 var cbid=data.split('"cbid":')[1].split('"')[1];
//                 console.log(cbid);
//                 var search_chars=['/', '\\+'];
//                 //obtain session key
//                 var session_key=encodeURIComponent(data.split('"webserversession":')[1].split('"')[1].split(',')[1].split('=')[0], search_chars);
//                 console.log(session_key);
//
//                 let promises=[];
//
//                 var datasets=["MQ_Fundamentals", "DividendsHistory"];
//                 for(var i=0; i<datasets.length; i++){
//                   console.log(`datasets=${datasets[i]}\n\n\n`);
//                   promises.push(dataset_fetch(datasets[i], ticker, session_key, cbid));
//                 }
//
//                 promises.push(snapshot_get(ticker, session_key, cbid));
//
//                 Promise.all(promises).then(function(result){
//                   console.log(result);
//                   res.send(result);
//                 });
//
//               }).catch(function(err){
//                 res.send("CANNOT ACCESS DATA AT THIS TIME");
//                 return false;
//               });;
//             }).catch(function(err){
//               res.send("CANNOT ACCESS DATA AT THIS TIME");
//               return false;
//             });;
//             break;
//           }
//           else if((keyWord.search("--l") !== -1) && (keyWord.search("--all") !== -1)){
//             console.log(i);
//             console.log(`${data[i]["instrumentName"]}`);
//             let dataObj=new Object();
//             //dataobj[""]
//             //if(keyWord.search("--all") !== -1){
//               //res.send("--all");
//               // list.push({"ticker": data[i]["symbolTicker"], "last": data[i]["last"]});
//               // if(i === data.length - 1){
//               //   res.send(list);
//               // }
//             //}
//           }
//         }
//       });
//     }).catch(function(err){
//       res.send("CANNOT ACCESS DATA AT THIS TIME");
//     });
//   });
//
// }

function snapshot_get(ticker, session_key, cbid) {
  return new Promise(function (resolve, reject) {
    var url = `https://data2-widgets.dataservices.theice.com/snapshot?symbol=${ticker}&type=stock&username=nysecomwebsite&key=${session_key}&cbid=${cbid}`;
    get_options.url = url;
    axios(get_options)
      .then(function (response) {
        var body = response.data;
        var new_line_split = body.split("\n");

        // var data_arr=[];
        // for(var i=0; i<new_line_split.length; i++){
        //   if(new_line_split[i].search("=") !== -1){
        //     var dataObj=new Object();
        //     dataObj[new_line_split[i].split('=')[0]]=new_line_split[i].split('=')[1];
        //     data_arr.push(dataObj);
        //   }
        // }
        var data_arr = [];
        var dataObj = new Object();
        for (var i = 0; i < new_line_split.length; i++) {
          if (new_line_split[i].search("=") !== -1) {
            //var dataObj=new Object();
            dataObj[new_line_split[i].split("=")[0]] =
              new_line_split[i].split("=")[1];
            //data_arr.push(dataObj);
          }
        }
        console.log(dataObj);
        //res.send(data_arr);
        resolve(dataObj);
      })
      .catch(function (err) {
        res.send("CANNOT ACCESS DATA AT THIS TIME");
        return false;
      });
  });
}

function dataset_fetch(dataset, ticker, session_key, cbid) {
  return new Promise(function (resolve, reject) {
    var dataUrl_start =
      "https://data2-widgets.dataservices.theice.com/fsml?requestType=content&username=nysecomwebsite&key=";
    var dataUrl_end = `&dataset=${dataset}&fsmlParams=key%3D${ticker}&json=true`;

    var dataUrl = `${dataUrl_start}${session_key}&cbid=${cbid}${dataUrl_end}`;
    console.log(dataUrl);

    get_options.url = dataUrl;

    axios(get_options)
      .then(function (response) {
        var data = response.data;
        console.log(data);
        resolve(data);
      })
      .catch(function (err) {
        //res.send("CANNOT ACCESS DATA AT THIS TIME");
        return false;
      });
  });
}

//NASDAQ API

function nasdaq_get(params, res) {
  let keyWord = params.keyWord;
  let mode = params.mode;
  let resultFilter = params.filter;

  var msg_str = "";
  const url = "https://api.nasdaq.com/api/quote/list-type/nasdaq100";

  var options = {
    url: url,
    method: "get",
    headers: {
      Host: "api.nasdaq.com",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:97.0) Gecko/20100101 Firefox/97.0",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-GB,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      Referer: "https://www.nasdaq.com/",
      Origin: "https://www.nasdaq.com",
      Connection: "keep-alive",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
      "Sec-GPC": 1,
      "Cache-Control": "max-age=0",
    },
  };

  var signal_Dict = {
    "+": 1,
    "-": 0,
  };

  var title_Str = "Command guide for accessing NASDAQ100 data";
  var help_Str = `${title_Str}<br>${line_generator("-", title_Str.length - 1)}<br><br>
  1. To display the components of NASDAQ100: "nasdaq_get --l"<br>
  2. To display data associated with a specific company: "nasdaq_get --kw(TICKER OR COMPANY Name)"<br>
  3. To display market info: "nasdaq_get --market-info"<br>`;

  if (keyWord.search("--l") !== -1 || keyWord.search("--all") !== -1) {
    console.log("listing!!!");
    axios(options)
      .then(function (response) {
        let arr = [];
        var body = response.data;

        if (typeof body.data !== "undefined" && body.data !== null) {
          console.log("\n\n\n");
          console.log(typeof body.data);
          console.log("\n");
          console.log(body.data);
          console.log("\n\n\n");

          var date_str = `Time Stamp: ${body.data["date"]}`;
          var stock_recs = body.data.data.rows;
          //console.log(stock_recs);
          msg_str =
            msg_str +
            `Components of NASDAQ100\n${date_str}\n${line_generator("-", date_str.length - 1)}\n\n`;
          Object.keys(stock_recs).forEach(function (key) {
            //console.log(key);
            let dataObj = new Object();

            var companyName = stock_recs[key].companyName.toString();
            var symbol = stock_recs[key].symbol.toUpperCase();
            var last = stock_recs[key].lastSalePrice;

            msg_str = msg_str + `Symbol: ${symbol}, Name: ${companyName}\n\n`;
            dataObj["Symbol"] = symbol;
            dataObj["Company Name"] = companyName;
            if (keyWord.search("--all") !== -1) {
              dataObj["last"] = last;
            }
            arr.push(dataObj);
          });
          res.send(arr);
          console.log(msg_str);
        } else {
          res.send(false);
          return false;
        }
      })
      .catch(function (err) {
        console.log(err);
        res.send(false);
      });
  } else if (keyWord.toLowerCase().search("help") !== -1) {
    console.log(help_Str);
    res.send(help_Str);
  } else if (keyWord.toLowerCase().search("market-info") !== -1) {
    console.log("retrieving market info...");
    options.url = "https://api.nasdaq.com/api/market-info";
    axios(options)
      .then(function (response) {
        var body = response.data;
        console.log(body.data);

        //var info_str="";
        //let arr=[];

        // Object.keys(body.data).forEach(function(el, idx){
        //     //console.log(`${el}: ${body.data[el]}`);
        //     info_str=info_str+`${el}: ${body.data[el]}\n`
        //     var dataObj=new Object();
        //     dataObj[el] = body.data[el];
        //     arr.push(dataObj);
        // });
        // console.log(arr);
        // res.send(arr);

        res.send(body);

        //info_str=`${line_generator('*', 50)}\n\n${info_str}`;
        //console.log(info_str);
        //res.send(info_str);
      })
      .catch(function (err) {
        console.log(`Error: ${err}`);
        res.send(false);
      });
  } else {
    axios(options)
      .then(function (response) {
        var body = response.data;
        if (typeof body.data !== "undefined" && body.data !== null) {
          var date = body.data["date"];
          var stock_recs = body.data.data.rows;
          msg_str = msg_str + `Time Stamp: ${date}\n`;
          let arr = [];

          Object.keys(stock_recs).forEach(function (key) {
            var companyName = stock_recs[key].companyName.toString();
            var symbol = stock_recs[key].symbol.toUpperCase();

            let search = -1;

            let tickerSearch_includes = symbol
              .toLowerCase()
              .search(keyWord.toLowerCase());
            let nameSearch_includes = companyName
              .toLowerCase()
              .search(keyWord.toLowerCase());
            let tickerSearch_equals =
              keyWord.toLowerCase() == symbol.toLowerCase();
            let nameSearch_equals =
              keyWord.toLowerCase() == companyName.toLowerCase();
            console.log(symbol);
            console.log(
              tickerSearch_includes,
              nameSearch_includes,
              tickerSearch_equals,
              nameSearch_equals,
            );
            //console.log(`nameSearch_includes`)

            // let nameSearch=companyName.toLowerCase().search(keyWord.toLowerCase());
            // let tickerSearch=symbol.toLowerCase().search(keyWord.toLowerCase());
            //
            // if(mode === "ticker"){
            //   search=tickerSearch_includes;
            // }
            // else if(mode === "name"){
            //   search=nameSearch_includes;
            // }
            // else if(mode === "ticker/name"){
            //   if(tickerSearch_includes !== -1){
            //     search=tickerSearch_includes;
            //   }
            //   else if(nameSearch_includes !== -1){
            //     search=nameSearch_includes;
            //   }
            // }

            if (mode === "ticker") {
              if (resultFilter === "equals" && tickerSearch_equals) {
                console.log("resultFilter === equals and tickerSearch_equals ");
                search = 1;
              } else if (resultFilter === "including") {
                search = tickerSearch_includes;
              }
            } else if (mode === "name") {
              if (resultFilter === "equals" && nameSearch_equals) {
                console.log("resultFilter === equals and nameSearch_equals");
                search = 1;
              } else if (resultFilter === "including") {
                search = nameSearch_includes;
              }
            } else if (mode === "ticker/name") {
              if (resultFilter === "equals") {
                if (tickerSearch_equals) {
                  search = 1;
                } else if (nameSearch_equals) {
                  search = 1;
                }
              } else if (resultFilter === "including") {
                if (tickerSearch_includes !== -1) {
                  search = tickerSearch_includes;
                } else if (nameSearch_includes !== -1) {
                  search = nameSearch_includes;
                }
              }
            }

            if (search !== -1) {
              var marketCap = stock_recs[key].marketCap;
              var last = stock_recs[key].lastSalePrice;
              var netChange = stock_recs[key].netChange;
              var percenChange = stock_recs[key].percentageChange;

              let dataObj = new Object();
              dataObj["Time Stamp"] = date;
              dataObj["Company Name"] = companyName;
              dataObj["symbol"] = symbol;
              dataObj["marketCap"] = marketCap;
              dataObj["last"] = last;
              dataObj["netChange"] = netChange;
              dataObj["percenChange"] = percenChange;
              arr.push(dataObj);
              //
              msg_str = `${line_generator("*", 50)}\n\nSource: ${url}\n\nSymbol: ${symbol}\n\nName: ${companyName}\n\nMarket Cap: ${marketCap}\n\nLast sale price: ${last}\n\nNet change: ${netChange}\n\nPercentage change: ${percenChange}`;
              console.log(msg_str);
              res.send(arr);
              return false;
            }
          });
          res.send(false);
        } else {
          res.send(false);
          return false;
        }
      })
      .catch(function (err) {
        console.log(`Error: ${err}`);
      });
  }
}

function crypto_get(params, res) {
  let keyWord = params.keyWord;
  var options = {
    method: "get",
    headers: {
      Host: "api.nasdaq.com",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:97.0) Gecko/20100101 Firefox/97.0",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-GB,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      Referer: "https://www.nasdaq.com/",
      Origin: "https://www.nasdaq.com",
      Connection: "keep-alive",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
      "Sec-GPC": 1,
      "Cache-Control": "max-age=0",
    },
  };

  if (keyWord !== null) {
    let url = `https://api.nasdaq.com/api/autocomplete/slookup/10?search=${keyWord}`;
    options.url = url;
    axios(options)
      .then(function (response) {
        console.log(response.data.data[0]);
        let entry = response.data.data[0];
        let symbol = entry.symbol;
        let asset = entry.asset.toLowerCase();
        console.log(symbol, asset);

        let url1 = `https://api.nasdaq.com/api/quote/${symbol}/info?assetclass=${asset}`;
        console.log(url1);
        options.url = url1;
        axios(options)
          .then(function (response) {
            console.log(response.data);
            res.send(response.data);
          })
          .catch(function (err) {
            console.log(err);
            res.send(false);
          });
      })
      .catch(function (err) {
        console.log(err);
        res.send(false);
      });
  }
}

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

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

app.get("/test", (req, res) => {
  res.send("test");
});

app.post("/nasdaq", (req, res) => {
  console.log(req.body.params);
  //res.send(req.body.keyWord);
  nasdaq_get(req.body.params, res);
});

app.post("/nyse", (req, res) => {
  //pass params
  console.log(req.body.params);
  nyse_get(req.body.params, res);
});

app.post("/crypto", (req, res) => {
  console.log(req.body.params);
  crypto_get(req.body.params, res);
});

app.post("/hist", function (req, res) {
  console.log("starting...");
  //let symbol="PM";
  var options = {
    method: "get",
    headers: {
      Host: "api.nasdaq.com",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:97.0) Gecko/20100101 Firefox/97.0",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-GB,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      Referer: "https://www.nasdaq.com/",
      Origin: "https://www.nasdaq.com",
      Connection: "keep-alive",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
      "Sec-GPC": 1,
      "Cache-Control": "max-age=0",
    },
  };
  console.log(req.body.params);
  let symbol = req.body.params.symbol;
  var limit = 200;
  var date = new Date();
  const formattedDate = date.toISOString().slice(0, 10);

  if (symbol !== null) {
    //let url=`https://api.nasdaq.com/api/quote/${symbol}/historical?assetclass=stocks&fromdate=2018-05-01&limit=18&todate=2018-07-01`;
    let url = `https://api.nasdaq.com/api/quote/${symbol}/historical?assetclass=stocks&fromdate=2012-08-10&limit=${limit}&todate=${formattedDate}`;
    console.log(url);
    options.url = url;
    axios(options)
      .then(function (response) {
        let body = response.data;
        console.log(body);
        if (body != null) {
          if (body.data.totalRecords != null) {
            console.log("\n\n\n" + body.data.totalRecords);
            limit = body.data.totalRecords;
            url = `https://api.nasdaq.com/api/quote/${symbol}/historical?assetclass=stocks&fromdate=2012-08-10&limit=${limit}&todate=${formattedDate}`;
            axios.get(url).then(function (response) {
              body = response.data;
              res.send(body);
            });
          }
        } else {
          res.send("Err");
        }
      })
      .catch(function (err) {
        res.send("Err");
      });
  }
});

app.get("/logo/:ticker", async (req, res) => {
  const ticker = req.params.ticker;
  const response = await fetch(
    `https://img.logo.dev/ticker/${ticker}?token=${process.env.LOGO_DEV_KEY}`,
  );

  const buffer = await response.arrayBuffer();
  res.set("Content-Type", "image/png");
  res.send(Buffer.from(buffer));
});

app.get("/logos/:tickers", async (req, res) => {
  try {
    const tickers = req.params.tickers.split(","); // e.g., "AAPL,MSFT,GOOG"

    // Fetch all logos in parallel
    const logoBuffers = await Promise.all(
      tickers.map(async (ticker) => {
        const response = await fetch(
          `https://img.logo.dev/ticker/${ticker}?token=${process.env.LOGO_DEV_KEY}`,
        );
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer);
      }),
    );

    // Return as base64 JSON so frontend can render images quickly
    const logosBase64 = logoBuffers.map((buf) => buf.toString("base64"));

    res.json({
      tickers,
      logos: logosBase64, // frontend can do <img src={`data:image/png;base64,${logos[i]}`}/>
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch logos" });
  }
});

app.listen(port, function () {
  console.log(`server running at port: ${port}`);
});
