const web3 = require('@solana/web3.js');
const raydium_sdk_1 = require("@raydium-io/raydium-sdk");
const WebSocket = require('ws');
const derivePoolKeys = require('./derivePoolKeys.js');
const swap = require('./swap2.js');
const config = require('../utils/config.js');

const connection = config.connection;

const ws = new WebSocket(config.websocketConnection)
    ws.onopen = () => {
        ws.send(
            JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'blockSubscribe',
                params: [{"mentionsAccountOrProgram": "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX"}, {"commitment": "confirmed", "maxSupportedTransactionVersion": 0, "encoding": "jsonParsed"}]
            })
        )
    }

ws.on('message', (evt) => {
    try {
        console.log("mesage received")
        const buffer = evt.toString('utf8');
        parseTxs(JSON.parse(buffer));
        return;
    } catch (e) {
        console.log(e)
    }
})

function parseTxs(txsFromBlock){
    if(txsFromBlock.params === undefined){
        return;
    }
    const allTx = txsFromBlock.params.result.value.block.transactions;
    for(const tx of allTx){
        if(parseLogs(tx.meta.logMessages) && tx.transaction.message.accountKeys.length === 13 && tx.transaction.message.instructions.length === 6){
            ws.close();
            console.log(tx.transaction.signatures)
            parseAccountKeys(tx.transaction.message.accountKeys, tx.transaction.signatures);
        }
    }
}

function parseLogs(logs){
    let invoke = 0;
    let consumed = 0;
    let success = 0;
    for(const log of logs){
        if(log.includes("Program srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX invoke")){
            invoke += 1;
        }
        if(log.includes("Program srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX consumed")){
            consumed += 1;
        }
        if(log.includes("Program srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX success")){
            success += 1;
        }
    }
    if(invoke === 1 && consumed === 1 && success === 1){
        console.log("parse logs returned true")
        return true;
    } else{
        return false;
    }
}

async function parseAccountKeys(keys, signature){
    let marketId = null;
    let hitTarget = false;
    console.log(keys);
    for(const key of keys){ // TODO: keys contains the CA?
        const keyData = await connection.getAccountInfo(new web3.PublicKey(key.pubkey));
        if(keyData !== null && keyData.data.length === 388){
            marketId = key.pubkey;
        }
        if (key.pubkey === config.targetCA){
            hitTarget = true;
        }
    }

    if(marketId === null){
        console.log("call parseAccountKeys again");
        parseAccountKeys(keys);
    } else{
        if (hitTarget){
            console.log("hit target", signature);
            const poolKeys = await derivePoolKeys.derivePoolKeys(marketId);
            // swap.swap(poolKeys, signature);
            swap.loopSwap(poolKeys, signature);
        } else {
            console.log("not hit target", signature, keys);
        }
    }
}