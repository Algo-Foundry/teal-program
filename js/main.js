const algosdk = require("algosdk");
const fs = require("fs");
const path = require("path");

const algodClient = new algosdk.Algodv2(
  process.env.ALGOD_TOKEN,
  process.env.ALGOD_SERVER,
  process.env.ALGOD_PORT
);

const submitToNetwork = async (signedTxn) => {
    // send txn
    let tx = await algodClient.sendRawTransaction(signedTxn).do();
    console.log("Transaction : " + tx.txId);
  
    // Wait for transaction to be confirmed
    confirmedTxn = await algosdk.waitForConfirmation(algodClient, tx.txId, 4);
  
    //Get the completed Transaction
    console.log(
      "Transaction " +
        tx.txId +
        " confirmed in round " +
        confirmedTxn["confirmed-round"]
    );
  
    return confirmedTxn;
  };

(async () => {
  // Compile TEAL code
  const filePath = path.join(__dirname, "../artifacts/teal_demo.teal");
  const data = fs.readFileSync(filePath);
  const compiledProgram = await algodClient.compile(data).do();

  // Convert program to bytecode
  const programBytes = new Uint8Array(Buffer.from(compiledProgram.result, "base64"));
  
  // Input a amount to check
  const limitAmount = 1e7;
  const args = [algosdk.encodeUint64(limitAmount)];

  // Create logic signature from bytecode and arguments
  const lsig = new algosdk.LogicSigAccount(programBytes, args);
  const sender = algosdk.mnemonicToSecretKey(process.env.ACC1_MNEMONIC);
  lsig.sign(sender.sk);

  // get suggested parameters
  let suggestedParams = await algodClient.getTransactionParams().do();

  // use the logic signature of the delegated acc1 to sign transaction
  const receiver = algosdk.mnemonicToSecretKey(process.env.ACC2_MNEMONIC);
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: lsig.address(),
    to: receiver.addr,
    amount: 1e7, // 10 Algo
    suggestedParams,
  });

  // sign with logic signature
  const lstx = algosdk.signLogicSigTransactionObject(txn, lsig);

  await submitToNetwork(lstx.blob);
})();
