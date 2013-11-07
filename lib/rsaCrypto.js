(function() {
  var algorithm, rsaCrypto, ursa;



  ursa = require('ursa');

  algorithm = "sha1";

  rsaCrypto = (function() {
    function rsaCrypto(keySize, keyContent) {
      if (keyContent) {
        this.rsa = ursa.coerceKey(keyContent);
      } else {
        this.rsa = ursa.generatePrivateKey(keySize, 65537);
      }
      this.outblockSize = keySize / 8;
      this.inblockSize = keySize / 8 - 42;
    }

    rsaCrypto.prototype.Decrypt = function(content) {
      var pLength, processLength, result;
      result = [];
      processLength = 0;
      while ((content.length - processLength) >= this.outblockSize || processLength !== content.length) {
        pLength = Math.min(this.outblockSize, content.length - processLength);
        result.push(this.rsa.decrypt(content.slice(processLength, processLength + pLength)));
        processLength += pLength;
      }
      return new Buffer.concat(result);
    };

    rsaCrypto.prototype.Encrypt = function(content) {
      var pLength, processLength, result;
      result = [];
      processLength = 0;
      while ((content.length - processLength) >= this.inblockSize || processLength !== content.length) {
        pLength = Math.min(this.inblockSize, content.length - processLength);
        result.push(this.rsa.encrypt(content.slice(processLength, processLength + pLength)));
        processLength += pLength;
      }
      return new Buffer.concat(result);
    };

    rsaCrypto.prototype.Sign = function(content) {
      var hash;
      if (ursa.isPrivateKey(this.rsa)) {
        hash = this.rsa.hashAndSign(algorithm, content, 'binary', 'base64');
        return hash;
      } else {
        return void 0;
      }
    };

    rsaCrypto.prototype.Verify = function(o_content, d_content) {
      if (ursa.isPublicKey(this.rsa) || ursa.isPrivateKey(this.rsa)) {
        return this.rsa.hashAndVerify(algorithm, o_content, d_content, 'binary');
      } else {
        return void 0;
      }
    };

    rsaCrypto.prototype.toPem = function(IsPriv) {
      if (IsPriv) {
        return this.rsa.toPrivatePem('utf8');
      } else {
        return this.rsa.toPublicPem('utf8');
      }
    };

    return rsaCrypto;

  })();

  module.exports = {
    rsaCrypto: rsaCrypto
  };

}).call(this);
