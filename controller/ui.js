/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2026 Toha <tohenk@yahoo.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const fs = require('fs');
const path = require('path');
const Controller = require('@ntlab/express-controller');
const Express = require('express').application;

class UiController extends Controller {

    buildRoutes() {
        this.addRoute('index', 'get', '/', async (req, res, next) => {
            /** @type {import('..').SipdApi} */
            const api = req.app.api;
            api.counter = await api.getCount();
            for (const bridge of api.bridges) {
                bridge.stat = await bridge.getStats();
                bridge.last = await bridge.getLast();
                bridge.current = await bridge.getCurrent();
            }
            const socketOptions = {};
            if (req.app.get('root') !== '/') {
                socketOptions.path = req.getPath('/socket.io/');
            }
            socketOptions.reconnection = true;
            res.render('ui/index', {
                socket: {
                    url: `${req.getUri({noproto: true})}/ui`,
                    options: socketOptions,
                }
            });
        });
        this.addRoute('updates', 'get', '/updates', async (req, res, next) => {
            const result = {updates: {}};
            /** @type {import('..').SipdApi} */
            const api = req.app.api;
            result.counter = await api.getCount();
            for (const bridge of api.bridges) {
                bridge.stat = await bridge.getStats();
                bridge.last = await bridge.getLast();
                bridge.current = await bridge.getCurrent();
                result.updates[bridge.name] = {
                    ...bridge.stat,
                    last: bridge.last ? bridge.last.toString() : null,
                    current: bridge.current ? bridge.current.toString() : null,
                }
            }
            res.json(result);
        });
        this.addRoute('activity', 'get', '/activity', async (req, res, next) => {
            const result = {};
            /** @type {import('..').SipdApi} */
            const api = req.app.api;
            const logs = await api.getActivity();
            if (logs) {
                result.time = Date.now();
                result.logs = logs;
            }
            res.json(result);
        });
        this.addRoute('queue', 'get', '/queue', async (req, res, next) => {
            /** @type {import('..').SipdApi} */
            const api = req.app.api;
            const result = await api.getQueues(req.params.page || req.query.page, req.params.size || req.query.size);
            result.pages = req.app.locals.pager(result.count, result.size, result.page);
            res.json(result);
        });
        this.addRoute('log', 'get', '/log/:bridge', async (req, res, next) => {
            const result = {};
            if (req.params.bridge) {
                /** @type {import('..').SipdApi} */
                const api = req.app.api;
                const bridge = api.bridges.find(b => b.name === req.params.bridge);
                if (bridge) {
                    const logs = await bridge.getLogs();
                    if (logs) {
                        result.time = Date.now();
                        result.logs = logs;
                    }
                }
            }
            res.json(result);
        });
        this.addRoute('error', 'get', '/error', async (req, res, next) => {
            /** @type {import('..').SipdApi} */
            const api = req.app.api;
            const result = await api.getErrors(req.params.page || req.query.page, req.params.size || req.query.size);
            result.pages = req.app.locals.pager(result.count, result.size, result.page);
            res.json(result);
        });
        this.addRoute('about', 'get', '/about', (req, res, next) => {
            let about;
            if (req.app.about) {
                about = req.app.about;
            } else {
                const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json')));
                about = {
                    title: packageInfo.description,
                    version: packageInfo.version,
                    author: packageInfo.author.name ? `${packageInfo.author.name} <${packageInfo.author.email}>` :
                        packageInfo.author,
                    license: packageInfo.license
                }
            }
            res.json(about);
        });
        this.addRoute('task', 'post', '/task/:op', async (req, res, next) => {
            const result = {
                success: false
            }
            /** @type {import('..').SipdApi} */
            const api = req.app.api;
            switch (req.params.op) {
                case 'remove':
                    if  (req.body.error) {
                        Object.assign(result, await api.query({cmd: 'clean-err', error: req.body.error}));
                    }
                    break;
                case 'restart':
                    Object.assign(result, await api.query({cmd: 'restart'}));
                    break;
            }
            res.json(result);
        });
    }

    /**
     * Create controller.
     *
     * @param {Express} app Express app
     * @param {string} prefix Path prefix 
     * @returns {UiController}
     */
    static create(app, prefix = '/') {
        const controller = new UiController({prefix, name: 'Ui'});
        app.use(prefix, controller.router);
        return controller;
    }
}

module.exports = UiController.create;
