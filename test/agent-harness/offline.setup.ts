import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';
import * as tls from 'node:tls';

const blocked = () => {
  throw new Error('Newsletter harness forbids live network access.');
};

const networkSpies = [
  jest.spyOn(http, 'request').mockImplementation(blocked),
  jest.spyOn(http, 'get').mockImplementation(blocked),
  jest.spyOn(https, 'request').mockImplementation(blocked),
  jest.spyOn(https, 'get').mockImplementation(blocked),
  jest.spyOn(net.Socket.prototype, 'connect').mockImplementation(blocked),
  jest.spyOn(tls, 'connect').mockImplementation(blocked),
];

beforeEach(() => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(
      new Error(
        'Newsletter harness requires an explicit in-memory fetch mock.',
      ),
    );
});

afterEach(() => {
  for (const spy of networkSpies) expect(spy).not.toHaveBeenCalled();
});
