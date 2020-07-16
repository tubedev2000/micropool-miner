// Modules to control application life and create native browser window
const {app, BrowserWindow, ipcMain} = require('electron')
const storage = require('electron-json-storage');
const contextMenu = require('electron-context-menu');
const path = require('path');
const bonjour = require('nbonjour').create();
const os = require('os');

var emb_miner_status = 0;

global.minerconfig = { 
	poolport:25650, 
	poolhost:'',
	mining_login:'',
	emb_miner:false
};

function isDev() {
	return process.mainModule.filename.indexOf('app.asar') === -1;
}

function Log() {}
Log.prototype.log = function (level,message) {if(mainWindow)mainWindow.webContents.send('log', [level,message]);}
Log.prototype.info  = function (message) {this.log('info',message);}
Log.prototype.error = function (message) {this.log('error',message);}
Log.prototype.debug = function (message) {this.log('debug',message);}
const logger = new Log();

//process.on("uncaughtException", function(error) {
	//logger.error(error.toString());
//});


contextMenu({
	showInspectElement: false,
	showSearchWithGoogle: false
});

let mainWindow;
		
function loadstorage(key,callback)
{
	storage.has(key,function(error,haskey) {
		if(!error && haskey)
		{
			storage.get(key,function(error,object) {
				if(!error && object)
				{
					callback(false,object);
				}
				else
				{
					callback(true);
				}
			});
		}
		else
		{
			callback(true);
		}
	});
}

var miner_child;

function start_miner() {
	
	var appRootDir = require('app-root-dir').get();
	var minerpath;
	if(os.type() == 'Linux')
	{
		if(isDev()){
			minerpath = appRootDir + '/dist/bin/linux/miner';
		}else{
			appRootDir = path.dirname(appRootDir);
			minerpath = appRootDir + '/bin/miner';
		}
	}
	else
	{
		if(isDev()){
			minerpath = appRootDir + '\\dist\\bin\\win\\miner.exe';
		}else{
			appRootDir = path.dirname(appRootDir);
			minerpath = appRootDir + '\\bin\\miner.exe';
		}
	}
	const spawn = require( 'child_process' ).spawn;
	miner_child = spawn( minerpath, ['-w','0','--algo','cuckaroo29b','--server',global.minerconfig.poolhost+':'+global.minerconfig.poolport,'--user',global.minerconfig.mining_login]);  //add whatever switches you need here, test on command line first
	miner_child.stdout.on( 'data', data => {
		data = data.toString().replace(/^\s+|\s+$/g, '');
		mainWindow.webContents.send('log_daemon', data);
	});
	miner_child.stderr.on( 'data', data => {
		logger.error( data );
	});

}


function scan(){
	bonjour.find({ type: 'telnet' }, function (service) {
		if(service.name == 'micropool') {
			mainWindow.webContents.send('add_remote_micropool',service.referer.address, service.port);
		}
	});
}


function createWindow () {
	// Create the browser window.
	mainWindow = new BrowserWindow({
		title: 'Bittube Miner',
		width: 1000,
		height: 800,
		minWidth: 800,
		minHeight: 310,
		webPreferences: {nodeIntegration: true},
		icon: __dirname + '/build/icon_small.png'
	})

	//mainWindow.webContents.openDevTools();

	mainWindow.setMenu(null);

	mainWindow.loadFile('index.html');

	ipcMain.on('run',(event,arg) => {
		if(arg[0] === "scan_for_micropool") scan();
	});

	ipcMain.on('init',() => {
		loadstorage('poolport',function(error,object) {
			if(!error) global.minerconfig.poolport = object;
			loadstorage('poolhost',function(error,object) {
				if(!error) global.minerconfig.poolhost = object;
				loadstorage('mining_login',function(error,object) {
					if(!error) global.minerconfig.mining_login = object;
					loadstorage('emb_miner',function(error,object) {
						if(!error) global.minerconfig.emb_miner = object;
						
						mainWindow.webContents.send('set','poolhost', global.minerconfig.poolhost);
						mainWindow.webContents.send('set','poolport', global.minerconfig.poolport);
						mainWindow.webContents.send('set','mining_login', global.minerconfig.mining_login);
						mainWindow.webContents.send('set','emb_miner', global.minerconfig.emb_miner);

						bonjour.find({ type: 'telnet' }, function (service) {
							if(service.name == 'micropool') {
								mainWindow.webContents.send('add_remote_micropool',service.referer.address, service.port);
							}
						});
						
						if(global.minerconfig.emb_miner == 1) {
							start_miner();
						}
						
					});
				});
			});
		});
	});
	
	ipcMain.on('set',(event,arg) => {
		if(arg[0] === "mining_login") global.minerconfig.mining_login=arg[1];
		if(arg[0] === "poolport") global.minerconfig.poolport=arg[1];
		if(arg[0] === "poolhost") global.minerconfig.poolhost=arg[1];
		if(arg[0] === "emb_miner"){
			if(arg[1] != global.minerconfig.emb_miner) {
				global.minerconfig.emb_miner=arg[1];
				if(global.minerconfig.emb_miner == 1) {
					start_miner();
				
				}else{
					if(miner_child)miner_child.kill();
				}
			}
		}

		storage.set(arg[0],arg[1]);

	});
	
	mainWindow.on('closed', function () {
		mainWindow = null
	})

}

app.on('ready', createWindow)

app.on('window-all-closed', function () {
	if (process.platform !== 'darwin') {
		app.quit()
	}
})

app.on('activate', function () {
	if (mainWindow === null) {
		createWindow()
	}
})

