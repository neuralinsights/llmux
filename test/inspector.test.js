
const inspector = require('../src/telemetry/inspector');
const EventEmitter = require('events');

describe('Live Flow Inspector SDK', () => {
    let mockIo;
    let mockSocket;

    beforeEach(() => {
        // Mock Socket.io
        mockSocket = new EventEmitter();
        mockIo = new EventEmitter();
        jest.spyOn(mockIo, 'emit');

        // Reset inspector
        inspector.attach(null); // Detach first
        inspector.enabled = true;
    });

    test('should attach to socket.io server', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        inspector.attach(mockIo);

        expect(consoleSpy).toHaveBeenCalledWith('[Inspector] Attached to WebSocket Server');

        // Simulate client connection
        mockIo.emit('connection', mockSocket);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Client connected'));

        consoleSpy.mockRestore();
    });

    test('should emit trace events when enabled', () => {
        inspector.attach(mockIo);

        inspector.trace('req-123', 'TEST_STAGE', { foo: 'bar' });

        expect(mockIo.emit).toHaveBeenCalledWith('trace', expect.objectContaining({
            requestId: 'req-123',
            stage: 'TEST_STAGE',
            data: { foo: 'bar' }
        }));
    });

    test('should not emit trace events when disabled', () => {
        inspector.attach(mockIo);
        inspector.enabled = false;

        inspector.trace('req-123', 'TEST_STAGE', { foo: 'bar' });

        expect(mockIo.emit).not.toHaveBeenCalled();
    });

    test('should create middleware that traces INBOUND and OUTBOUND', () => {
        inspector.attach(mockIo);
        const middleware = inspector.middleware();

        const req = { method: 'GET', originalUrl: '/api/test', ip: '127.0.0.1' };
        const res = new EventEmitter();
        res.statusCode = 200;
        const next = jest.fn();

        // Run middleware
        middleware(req, res, next);

        // Check INBOUND trace
        expect(mockIo.emit).toHaveBeenCalledWith('trace', expect.objectContaining({
            stage: 'INBOUND',
            data: expect.objectContaining({ method: 'GET', url: '/api/test' })
        }));

        // Check next called
        expect(next).toHaveBeenCalled();

        // Simulate response finish
        res.emit('finish');

        // Check OUTBOUND trace
        expect(mockIo.emit).toHaveBeenCalledWith('trace', expect.objectContaining({
            stage: 'OUTBOUND',
            data: expect.objectContaining({ statusCode: 200 })
        }));
    });
});
