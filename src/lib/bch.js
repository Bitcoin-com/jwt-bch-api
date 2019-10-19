/*
  A library for controlling the sending of BCH.
*/

'use strict'

const BCHJS = require('@chris.troutner/bch-js')
const bchjs = new BCHJS()

const walletInfo = require(`${__dirname}/../../config/wallet.json`)

let _this

class BCH {
  constructor () {
    this.bchjs = bchjs

    _this = this
  }

  // Retrieve the balance for a given address from an indexer.
  // Current indexer used: Blockbook
  // Returns value in satoshis.
  async getBalance (addr) {
    try {
      // Convert to a cash address.
      const bchAddr = this.bchjs.Address.toCashAddress(addr)
      // console.log(`bchAddr: ${bchAddr}`)

      // Get balance for address from Blockbook
      const addrInfo = await this.bchjs.Blockbook.balance(bchAddr)
      // console.log(`addrInfo: ${JSON.stringify(addrInfo, null, 2)}`)

      // Calculate the spot-balance
      const balance =
        Number(addrInfo.balance) + Number(addrInfo.unconfirmedBalance)
      // console.log(`balance: ${JSON.stringify(balance, null, 2)}`)

      return balance
    } catch (err) {
      console.error(`Error in bch.js/getBalance()`)
      throw err
    }
  }

  // Retrieve the utxos for a given address from an indexer.
  // Current indexer used: Blockbook
  async getUtxos (addr) {
    try {
      // Convert to a cash address.
      const bchAddr = this.bchjs.Address.toCashAddress(addr)
      // console.log(`bchAddr: ${bchAddr}`)

      // Get balance for address from Blockbook
      const utxos = await this.bchjs.Blockbook.utxo(bchAddr)
      // console.log(`utxos: ${JSON.stringify(utxos, null, 2)}`)

      return utxos
    } catch (err) {
      console.error(`Error in bch.js/getUtxos()`)
      throw err
    }
  }

  // Generate a change address from a Mnemonic of a private key.
  async changeAddrFromMnemonic (index) {
    try {
      // console.log(`walletInfo: ${JSON.stringify(walletInfo, null, 2)}`)

      if (!walletInfo.derivation) {
        throw new Error(`walletInfo must have integer derivation value.`)
      }
      // console.log(`walletInfo: ${JSON.stringify(walletInfo, null, 2)}`)

      // console.log(`index: ${index}`)
      if (!index && index !== 0) {
        throw new Error(`index must be a non-negative integer.`)
      }

      // root seed buffer
      const rootSeed = await this.bchjs.Mnemonic.toSeed(walletInfo.mnemonic)

      // master HDNode
      const masterHDNode = this.bchjs.HDNode.fromSeed(rootSeed)

      // HDNode of BIP44 account
      // console.log(`derivation path: m/44'/${walletInfo.derivation}'/0'`)
      const account = this.bchjs.HDNode.derivePath(
        masterHDNode,
        `m/44'/${walletInfo.derivation}'/0'`
      )

      // derive the first external change address HDNode which is going to spend utxo
      const change = this.bchjs.HDNode.derivePath(account, `0/${index}`)

      return change
    } catch (err) {
      console.log(`Error in bch.js/changeAddrFromMnemonic()`)
      throw err
    }
  }

  // Call the full node to validate that UTXO has not been spent.
  // Returns true if UTXO is unspent.
  // Returns false if UTXO is spent.
  async isValidUtxo (utxo) {
    try {
      // Input validation.
      if (!utxo.txid) throw new Error(`utxo does not have a txid property`)
      if (!utxo.vout && utxo.vout !== 0) { throw new Error(`utxo does not have a vout property`) }

      // console.log(`utxo: ${JSON.stringify(utxo, null, 2)}`)

      const txout = await this.bchjs.Blockchain.getTxOut(utxo.txid, utxo.vout)
      // console.log(`txout: ${JSON.stringify(txout, null, 2)}`)

      if (txout === null) return false
      return true
    } catch (err) {
      console.error('Error in bch.js/validateUtxo()')
      throw err
    }
  }

  // Sends all funds from fromAddr to toAddr.
  // Throws an address if the address at hdIndex does not match fromAddr.
  async sendAllAddr (fromAddr, hdIndex, toAddr) {
    try {
      const utxos = await this.getUtxos(fromAddr)
      console.log(`utxos: ${JSON.stringify(utxos, null, 2)}`)

      if (!Array.isArray(utxos)) throw new Error(`utxos must be an array.`)

      if (utxos.length === 0) throw new Error(`No utxos found.`)

      // instance of transaction builder
      const transactionBuilder = new this.bchjs.TransactionBuilder()

      let originalAmount = 0

      // Calulate the original amount in the wallet and add all UTXOs to the
      // transaction builder.
      for (var i = 0; i < utxos.length; i++) {
        const utxo = utxos[i]

        originalAmount = originalAmount + utxo.satoshis

        transactionBuilder.addInput(utxo.txid, utxo.vout)
      }

      if (originalAmount < 1) {
        throw new Error(`Original amount is zero. No BCH to send.`)
      }

      // original amount of satoshis in vin
      // console.log(`originalAmount: ${originalAmount}`)

      // get byte count to calculate fee. paying 1 sat/byte
      const byteCount = this.BITBOX.BitcoinCash.getByteCount(
        { P2PKH: utxos.length },
        { P2PKH: 1 }
      )
      const fee = Math.ceil(1.1 * byteCount)
      // console.log(`fee: ${byteCount}`)

      // amount to send to receiver. It's the original amount - 1 sat/byte for tx size
      const sendAmount = originalAmount - fee
      // console.log(`sendAmount: ${sendAmount}`)

      // add output w/ address and amount to send
      transactionBuilder.addOutput(
        this.bchjs.Address.toLegacyAddress(toAddr),
        sendAmount
      )

      let redeemScript

      // Loop through each input and sign
      for (let i = 0; i < utxos.length; i++) {
        const utxo = utxos[i]

        // Generate a keypair for the current address.
        const change = await this.changeAddrFromMnemonic(hdIndex)
        const keyPair = this.bchjs.HDNode.toKeyPair(change)

        transactionBuilder.sign(
          i,
          keyPair,
          redeemScript,
          transactionBuilder.hashTypes.SIGHASH_ALL,
          utxo.satoshis
        )
      }

      // build tx
      const tx = transactionBuilder.build()

      // output rawhex
      const hex = tx.toHex()
      // console.log(`Transaction raw hex: ${hex}`)

      return hex
    } catch (err) {
      console.error(`Error in bch.js/sendAllAddr()`)
      throw err
    }
  }
}

module.exports = BCH
