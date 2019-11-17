const MongoClient = require("mongodb").MongoClient;
const ObjectID = require('mongodb').ObjectID;

const bodyParser = require('body-parser');



const express = require("express");
// СЃРѕР·РґР°РµРј РѕР±СЉРµРєС‚ РїСЂРёР»РѕР¶РµРЅРёСЏ
const app = express();
// parse various different custom JSON types as JSON
app.use(bodyParser.urlencoded({
extended: true
}));

// parse application/json
app.use(bodyParser.json())


// СЃРѕР·РґР°РµРј РѕР±СЉРµРєС‚ MongoClient Рё РїРµСЂРµРґР°РµРј РµРјСѓ СЃС‚СЂРѕРєСѓ РїРѕРґРєР»СЋС‡РµРЅРёСЏ
const mongoClient = new MongoClient("mongodb://localhost:27017/", { useNewUrlParser: true });



// РѕРїСЂРµРґРµР»СЏРµРј РѕР±СЂР°Р±РѕС‚С‡РёРє РґР»СЏ РјР°СЂС€СЂСѓС‚Р° "/"

mongoClient.connect(async function(err, client){

   const db = client.db("itmobetdb");
   const userCol = db.collection("user");
   const eventCol = db.collection("event");
   const betCol = db.collection("bet");
   await userCol.createIndex( { "name" : 1 }, { unique : true } )
   await  eventCol.createIndex( { "event_name" : 1 }, { unique : true } )
   //let user = {name: "Tom", age: 23};

   // collection.insertOne(user, function(err, result){
   //
   //     if(err){
   //         return console.log(err);
   //     }
   //     console.log(result.ops);
   //     client.close();
   // });

   // const query = MySchema.findOne({ name: /tester/gi });
   // const userData = await query.exec();

  //

app.post('/user', function(req, res){
  userCol.insertOne({
    name: req.body.name+"",
    pass: req.body.pass+"",
    balance: req.body.balance || 10000.
  }, (err, result)=>{
    if(err){
      res.send(err);
      return
    }
    res.send("Succesfully added user: "+result)
    return
  })
});

app.post('/event', function(req, res){
  eventCol.insertOne({
    event_name: req.body.event_name+"",
    tag_string: req.body.tag_string+"",
    money_for: 100.,
    money_against: 100.

  }, (err, result)=>{
    if(err){
      res.send(err);
      return
    }
    res.send("Succesfully added event: "+result)
    return
  })
});
//todo: add negation of user balance!!!!
// TODO: not sure if it's finished. The BP is 1)check uid and eveid 2)create bet 3)change the event coefficient
app.post('/bet',async function(req, res){
  console.log(`${req.body.user_id} - ${ req.body.event_id}`);
  event_id = req.body.event_id;
  amount = req.body.amount;
  isUser =  await isUserbyId(ObjectID(req.body.user_id));
  isEvent = await isEventbyId(ObjectID(event_id));
  //--the side of the bet
  isFor = req.body.is_for;
  let currentRealCoeff;

  if(isUser && isEvent){

  if(!await isAmountForUserAcceptable(amount, req.body.user_id)){
    res.send(`The user with id = ${req.body.user_id} can not bet ${amount}.`)
    return;
  }else {
    await depleteUserBalanceById(req.body.user_id, amount)
  }
  //variables for logic for calculating bet coefficient
  thisEvent = await eventCol.findOne({_id: ObjectID(event_id)})
  money_for = thisEvent.money_for
  money_against = thisEvent.money_against

  // if(isFor){
  //   partOfAgainst = Math.round(money_against/(money_for+money_against) * 100) / 100
  //   currentRealCoeff = (1.87+1.87) * partOfAgainst
  //   //rising the betted money on the event for
  // }
  // else{
  //   partOfFor = Math.round(money_for/(money_for+money_against) * 100) / 100
  //   currentRealCoeff = (1.87+1.87) * partOfFor
  // }

  currentRealCoeff = calculateCurrentCoefficient(money_for,money_against,isFor);


  console.log(`user: ${isUser}, event: ${isEvent}`);

    console.log("creating bet");
    betCol.insertOne({
      user_id: req.body.user_id,
      event_id: event_id,
      bet_coeff: currentRealCoeff,
      amount: amount,
      bet_boolean: isFor
    }, (err, result)=>{

      if(err){
        console.log(2);
        res.send(err);
        return
      }
      //changing the coefficient
      changeEventMoneyById(event_id, isFor, amount);
      res.send("Succesfully added bet: "+result)
      return
    })
  }else{
  res.send(`Failed to add the bet, there is no pair of uid and eveid: ${req.body.user_id}, ${req.body.event_id}`);
  }
  return
});





app.get('/user', async (req,res)=>{
  console.log(`${req.query.name}, ${req.query.pass}` );
  res.send(await userCol.findOne({name: req.query.name, pass: req.query.pass}))
});

app.get('/user/balance', async (req,res)=>{
  console.log(`/user/balance ${req.query._id}` );
  res.send({balance: (await userCol.findOne({_id: ObjectID(req.query._id)})).balance})
})

app.get('/event', async (req,res)=>{
  //console.log(`${req.query.event_name}, ${req.query.tag_string}` );
  console.log(`finding in name and tag_string by query: ${req.query.query}`);
  const query_string = req.query.query
  res.send( getUniqueElementsArray(
    [...await eventCol.find({"event_name": new RegExp(`${query_string}`, 'i')}).toArray(),
    ...await eventCol.find({ "tag_string":  new RegExp(`${query_string}`, 'i') }).toArray()]
  ))
});
app.get('/event/coef',async (req,res)=>{
  const event_id = req.query.event_id;
  const isForText = req.query.is_for;
  console.log(`/event/coef | This is the event_id: ${event_id}`);
  thisEvent = await eventCol.findOne({_id: ObjectID(event_id)})
  if(thisEvent == null ) {
    res.send(`Event with id ${event_id} not found.`)
    return;
  }
  isFor = unwrapTextBoolean(isForText);
  if(isFor===null) {res.send(`Not a boolean at all: ${isForText}`); return;}
  console.log(`${isFor} = isFor, ${isForText} = isForText`);
  // if(isFor!==true && isFor!==false){
  //   res.send(`This is not a boolean: ${isFor}.`)
  // }

  money_for = thisEvent.money_for
  money_against = thisEvent.money_against

  currentRealCoeff = calculateCurrentCoefficient(money_for,money_against,isFor);
  res.send({coef:currentRealCoeff});
  console.log(`The coef being sent: ${currentRealCoeff}`);
  return
})

app.get('/event/all', async (req,res)=>{
  //console.log(`${req.query.event_name}, ${req.query.tag_string}` );
  res.send( getUniqueElementsArray(
    [...await eventCol.find({}).toArray()]
  ))
});

app.get('/bets',  async (req,res)=>{
  res.send( await betCol.find({}).toArray()
  )
});

app.get('/betsEvent', async(req,res)=>{
  res.send(await betCol.find({event_id: req.query.event_id}).toArray())
})

  app.delete("/event",async function(req, response){
    const id = req.query.id;
    const outcome = unwrapTextBoolean( req.query.outcome);
    if(outcome===null){
      response.send(`Outcome is not a boolean: ${outcome}`)
      return ;
    }
      if (await isEventbyId(ObjectID(id))){
        console.log("is event, entering the function");
        betsArray = await getEventsBetsById(id);

          console.log("the bets array: "+ betsArray);
        betsArray.forEach(async function(bet) {
          await resolveBet(bet, outcome);
        });
        await eventCol.deleteOne({_id: ObjectID(id)})
        response.send(
          //await isEventbyId(ObjectID("5dc1ca51b02f9c188c5d73c9"))
          `Succesfully deleted event with id ${id}, and its bets: ${betsArray}`
        );
        //response.send(await getEventsBetsById(id));
        return
      }
      // РѕС‚РїСЂР°РІР»СЏРµРј РѕС‚РІРµС‚
      response.send(
        //await isEventbyId(ObjectID("5dc1ca51b02f9c188c5d73c9"))
        `event with id ${id} is non-existant`
      );
      return
  }
);

//-----------------------------------------Functions start----------------------------------------


// TODO: finish the mathematical part of calculating the new proper coefficient
async function changeEventMoneyById(id, betBoolean, amount){

if(betBoolean){
  await eventCol.updateOne(
      { _id : ObjectID(id) },
      { $inc: { money_for : amount } }
   )
}else{
  await eventCol.updateOne(
      { _id : ObjectID(id) },
      { $inc: { money_against : amount } }
   )
}

//todo: test and bug fix?

  //var oldEventCoefficient = (await eventCol.findOne({_id: ObjectID(id)})).coeff;
  //console.log(oldEventCoefficient, betBoolean);
}

async function depleteUserBalanceById(id, balance){
  await userCol.updateOne(
      { _id : ObjectID(id) },
      { $inc: { balance : amount * (-1) } }
   )
}

function getUniqueElementsArray(array){
  return array.filter((thing,index) => {
    return index === array.findIndex(obj => {
      return JSON.stringify(obj) === JSON.stringify(thing);
    });
  });

}

function unwrapTextBoolean(tB){
  if(tB === 'true') return true;
  if(tB === 'false') return false;
  return null;
}

function calculateCurrentCoefficient(money_for,money_against,is_for){

  let currentRealCoeff;
  if(is_for){
    partOfAgainst = Math.round(money_against/(money_for+money_against) * 100) / 100
    currentRealCoeff = (1.87+1.87) * partOfAgainst
    //rising the betted money on the event for
  }
  else{
    partOfFor = Math.round(money_for/(money_for+money_against) * 100) / 100
    currentRealCoeff = (1.87+1.87) * partOfFor
  }

  if(currentRealCoeff<1) currentRealCoeff = 1.01
  currentRealCoeff = Math.round( (currentRealCoeff *100) )/100
  return currentRealCoeff
}

async function isUserbyId(id){
  user =   await userCol.findOne(
      {
        _id: ObjectID(id)
      }
    );
    return user!=null
}

async function isEventbyId(id){
  event =   await eventCol.findOne(
      {
        _id:  ObjectID(id)
      }
    );
    return event!=null
}

async function getEventsBetsById(id){

  console.log(`finding the according bets, id is ${id}`);
  return await betCol.find({event_id: id}).toArray();
}

async function isAmountForUserAcceptable(amount, id){
  user = await userCol.findOne(
      {_id: ObjectID(id)}
    );
    if(user==null) return false;
    console.log(user);
  if(!isNaN(amount) && user.balance>=amount) {return true;}
  else {return false;};
}



async function resolveBet(bet, outcome){

  user_id = bet.user_id;
  amount = bet.amount;
  coefficient = bet.bet_coeff;
  console.log(`Here is the current balance: ${
    await userCol.findOne({ _id : ObjectID(user_id) }).balance
  }, here is the amount*coefficient: ${amount*coefficient}`);
  if(bet.bet_boolean == outcome){
    await userCol.updateOne(
        { _id : ObjectID(user_id) },
        { $inc: { balance : amount*coefficient } }
     );
  }

  await betCol.deleteOne({_id: ObjectID(bet._id)});
}
  // // РЅР°С‡РёРЅР°РµРј РїСЂРѕСЃР»СѓС€РёРІР°С‚СЊ РїРѕРґРєР»СЋС‡РµРЅРёСЏ РЅР° 3000 РїРѕСЂС‚Сѓ
  app.listen(3000);

});
