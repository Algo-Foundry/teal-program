const algosdk = require("algosdk");
const fs = require("fs");
const path = require("path");

const algodClient = new algosdk.Algodv2(process.env.ALGOD_TOKEN, process.env.ALGOD_SERVER, process.env.ALGOD_PORT);

const submitToNetwork = async (signedTxn) => {
    // send txn
    let tx = await algodClient.sendRawTransaction(signedTxn).do();
    console.log("Transaction : " + tx.txId);

    // Wait for transaction to be confirmed
    confirmedTxn = await algosdk.waitForConfirmation(algodClient, tx.txId, 4);

    //Get the completed Transaction
    console.log("Transaction " + tx.txId + " confirmed in round " + confirmedTxn["confirmed-round"]);

    return confirmedTxn;
};

(async () => {
    // Compile TEAL code
    const filePath = path.join(__dirname, "../artifacts/teal_demo.teal");
    const data = fs.readFileSync(filePath);
    const compiledProgram = await algodClient.compile(data).do();

    // Convert program to bytecode
    const programBytes = new Uint8Array(Buffer.from(compiledProgram.result, "base64"));

    // Input a password
    const password = "algorandIsAwesome";
    const args = [];
    args.push(Buffer.from(password));

    // Create logic signature from bytecode and arguments
    const lsig = new algosdk.LogicSigAccount(programBytes, args);
    const sender = algosdk.mnemonicToSecretKey(process.env.ACC1_MNEMONIC);
    lsig.sign(sender.sk);

    // get suggested parameters
    let suggestedParams = await algodClient.getTransactionParams().do();

    // perform atomic transfer
    const receiver = algosdk.mnemonicToSecretKey(process.env.ACC2_MNEMONIC);
    const txn1 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: lsig.address(),
        to: receiver.addr,
        amount: 1e6, // 1 Algo
        suggestedParams,
    });

    const creator = algosdk.mnemonicToSecretKey(process.env.MNEMONIC_CREATOR);
    const txn2 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: lsig.address(),
        to: creator.addr,
        amount: Math.round(1e6 * 0.1), // 1 Algo
        suggestedParams,
    });

    // Assign group ID
    let txns = [txn1, txn2];
    let txgroup = algosdk.assignGroupID(txns);

    // Sign with logic signature
    const lstx1 = algosdk.signLogicSigTransactionObject(txn1, lsig);
    const lstx2 = algosdk.signLogicSigTransactionObject(txn2, lsig);

    // Combined signed txns
    let signed = [];
    signed.push(lstx1.blob, lstx2.blob);

    await submitToNetwork(signed);
})();
