'use strict';

class ContractRegistryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ContractRegistryError';
    this.code = code;
  }
}

module.exports = {
  ContractRegistryError,
};
