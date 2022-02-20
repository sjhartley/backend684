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

                var datasets=["MQ_Fundamentals", "DividendsHistory"];
                for(var i=0; i<datasets.length; i++){
                  console.log(`datasets=${datasets[i]}\n\n\n`);
                  dataset_fetch(datasets[i], ticker, session_key, cbid, res);
                }
                snapshot_get(ticker, session_key, cbid, res).then(function(response){
                  console.log("---------------------------------");
                  console.log(`snapshot response\n\n\n`);
                  console.log(response);
                  resolve(response);
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

function snapshot_get(ticker, session_key, cbid, res){
  var url=`https://data2-widgets.dataservices.theice.com/snapshot?symbol=${ticker}&type=stock&username=nysecomwebsite&key=${session_key}&cbid=${cbid}`;

  get_options.url=url;


  return new Promise(function(resolve, reject){
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

function dataset_fetch(dataset, ticker, session_key, cbid, res){
  var dataUrl_start="https://data2-widgets.dataservices.theice.com/fsml?requestType=content&username=nysecomwebsite&key=";
  var dataUrl_end=`&dataset=${dataset}&fsmlParams=key%3D${ticker}&json=true`;

  var dataUrl=`${dataUrl_start}${session_key}&cbid=${cbid}${dataUrl_end}`;
  console.log(dataUrl);

  get_options.url=dataUrl;

  axios(get_options).then(function(response){
    var data=response.data;
    console.log(data);
  });
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

app.get("/test", (req, res) => {
  res.send("test");
});

app.post("/api1", (req, res) => {
  console.log(req.body.keyWord);
  console.log("---------------------------------------");
  console.log(`localhost:${port} api is running`);
  const data = {
    result: `Success! from localhost on localhost:${port}!!`,
  };
  //res.send(data);
  // axios.get("https://www.nyse.com/api/idc/td").then(function(response){
  //   console.log(response.data);
  // })
  nyse_get(req.body.keyWord, res).then(function(response){
    console.log(`-------------------------------------\n`);
    console.log(`nyse_get response\n\n`);
    console.log(response);
    res.send(response);
  });

});

app.listen(port, function () {
  console.log(`server running now.. ${port}`);
});
