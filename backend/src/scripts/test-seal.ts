import { Logger } from '@nestjs/common';

// Use require() to get the CJS export which is a function
const SEAL = require('node-seal');

async function testSeal() {
  const logger = new Logger('SealTest');

  try {
    logger.log('Testing SEAL library initialization...');

    // Initialize SEAL - now SEAL is actually a function you can await
    const seal = await SEAL();
    logger.log('✅ SEAL library initialized successfully');

    // Set up encryption parameters for BFV scheme (supports integer arithmetic)
    const encParms = seal.EncryptionParameters(seal.SchemeType.bfv);

    // Set the polynomial modulus degree (power of 2)
    encParms.setPolyModulusDegree(4096);

    // Set the coefficient modulus
    encParms.setCoeffModulus(seal.CoeffModulus.BFVDefault(4096));

    // Set the plaintext modulus (must be prime for BFV)
    encParms.setPlainModulus(seal.PlainModulus.Batching(4096, 20));

    // Create SEALContext
    const context = seal.Context(encParms, true, seal.SecurityLevel.tc128);

    // Verify context is valid
    if (!context.parametersSet()) {
      throw new Error('SEAL context parameters not set correctly');
    }
    logger.log('✅ SEAL context created and validated');

    // Set up encoder for integers
    const encoder = seal.BatchEncoder(context);

    // Generate keys
    const keyGenerator = seal.KeyGenerator(context);
    const publicKey = keyGenerator.createPublicKey();
    const secretKey = keyGenerator.secretKey();
    logger.log('✅ Encryption keys generated');

    // Create encryptor and decryptor
    const encryptor = seal.Encryptor(context, publicKey);
    const decryptor = seal.Decryptor(context, secretKey);

    // Create evaluator for homomorphic operations
    const evaluator = seal.Evaluator(context);
    logger.log('✅ Encryptor, decryptor, and evaluator created');

    // Test encryption and decryption
    const plaintextValue = 42;
    const plaintextArray = new Uint32Array([plaintextValue]); // BatchEncoder works with typed arrays
    const plaintext = seal.PlainText();
    encoder.encode(plaintextArray, plaintext);

    const ciphertext = seal.CipherText();
    encryptor.encrypt(plaintext, ciphertext);
    logger.log(`✅ Encrypted value ${plaintextValue}`);

    // Decrypt to verify
    const decryptedPlaintext = seal.PlainText();
    decryptor.decrypt(ciphertext, decryptedPlaintext);
    const decryptedArray = encoder.decode(decryptedPlaintext);
    const decryptedValue = decryptedArray[0]; // Get first element

    if (decryptedValue === plaintextValue) {
      logger.log(`✅ Decryption successful: ${decryptedValue}`);
    } else {
      throw new Error(
        `Decryption failed: expected ${plaintextValue}, got ${decryptedValue}`,
      );
    }

    // Test homomorphic addition
    const plaintextValue2 = 58;
    const plaintextArray2 = new Uint32Array([plaintextValue2]);
    const plaintext2 = seal.PlainText();
    encoder.encode(plaintextArray2, plaintext2);
    const ciphertext2 = seal.CipherText();
    encryptor.encrypt(plaintext2, ciphertext2);

    // Add ciphertexts homomorphically
    const resultCiphertext = seal.CipherText();
    evaluator.add(ciphertext, ciphertext2, resultCiphertext);

    // Decrypt result
    const resultPlaintext = seal.PlainText();
    decryptor.decrypt(resultCiphertext, resultPlaintext);
    const resultArray = encoder.decode(resultPlaintext);
    const resultValue = resultArray[0]; // Get first element

    const expectedSum = plaintextValue + plaintextValue2;
    if (resultValue === expectedSum) {
      logger.log(
        `✅ Homomorphic addition successful: ${plaintextValue} + ${plaintextValue2} = ${resultValue}`,
      );
    } else {
      throw new Error(
        `Homomorphic addition failed: expected ${expectedSum}, got ${resultValue}`,
      );
    }

    logger.log('🎉 All SEAL tests passed successfully!');
    return true;
  } catch (error) {
    logger.error(`❌ SEAL test failed: ${error.message}`);
    logger.error(error.stack);
    return false;
  }
}

if (require.main === module) {
  testSeal().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

export { testSeal };
