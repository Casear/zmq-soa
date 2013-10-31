ursa = require 'ursa'
algorithm = "sha1"
class rsaCrypto
    constructor:(keySize,keyContent)-> 
        if keyContent
            @rsa  = ursa.coerceKey(keyContent)
            @verifier = ursa.createVerifier(algorithm)
        else
            @rsa  = ursa.generatePrivateKey(keySize,65537)
            @signer = ursa.createSigner(algorithm)
        @outblockSize = keySize/8
        @inblockSize = keySize/8 - 42
    Decrypt:(content)->
        result = []
        processLength = 0;
        while (content.length - processLength) >= @outblockSize or processLength isnt content.length  
            pLength = Math.min(@outblockSize, content.length - processLength)
            result.push(@rsa.decrypt(content.slice(processLength,processLength+pLength)))
            processLength += pLength;        
        new Buffer.concat(result)
    Encrypt:(content)->
        result = []
       
        processLength = 0;
        while (content.length - processLength) >= @inblockSize or processLength isnt content.length    
            pLength = Math.min(@inblockSize, content.length - processLength);
            console.log(content.slice(processLength,processLength+pLength).length)
            result.push(@rsa.encrypt(content.slice(processLength,processLength+pLength)));
            processLength += pLength;


        new Buffer.concat(result)
    Sign:(content)->
        if ursa.isPrivateKey(@rsa)
            
            hash = @rsa.hashAndSign(algorithm,content,'binary','base64')
            console.log('Hash length ',hash.length)
            hash
        else
            undefined
    Verify:(o_content,d_content)->
        if  ursa.isPublicKey(@rsa) or ursa.isPrivateKey(@rsa)
            @rsa.hashAndVerify(algorithm,o_content,d_content,'binary')
        else
            undefined
    toPem:(IsPriv)->
        if IsPriv
            @rsa.toPrivatePem('utf8')
        else
            @rsa.toPublicPem('utf8')
      
module.exports = 
  rsaCrypto : rsaCrypto
