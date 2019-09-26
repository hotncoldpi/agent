
const argv = require('minimist')(process.argv.slice(2));
const Configstore = require('configstore');
const fs = require('fs');
const os = require('os');

//lib subdir
const files = require('./lib/files');
const restCalls = require('./lib/rest');

//global error handler
process.on('uncaughtException', function (err) {
  console.error((new Date).toUTCString() + ' uncaughtException:', err.message)
  //console.error(err.stack)
  process.exit(1)
})

var version  = '0.0.3b';
var username = '';
var password = '';

function splitColonPair(pair) {return splitPair(pair, ':');}
function splitEqualPair(pair) {return splitPair(pair, '=');}
function splitSpacePair(pair) {return splitPair(pair, ' ');}
function splitPair(pair, divider) {
	
	if (pair == null)
		return null;
	
	var index = pair.indexOf(divider);
	if (index == -1)
		return null;
	
	return { a: pair.substring(0, index), b: pair.substring(index + 1) };
}

function isCharNumber(c){
    return c >= '0' && c <= '9';
}
function validEntry(entry) {
	var ret = true;
	entry.split('').forEach(
		function(p){
			if (!isCharNumber(p) && p != '-') ret = false;
		}
	);
	return ret;
}

////////////////////////////////////////////////////

function writeAgentsToJavascript(data, response) {
	console.log('writeAgentsToJavascript')
	//console.log(response.IncomingMessage)
	
	var mainServer = conf.get('server'); 
	var datetime = (new Date).toUTCString();
	var output = "var mainServer = '" + mainServer + "'; var datetime = '" + datetime + "';";
	fs.writeFileSync('active_agents.js', output + ' var agents = ' + JSON.stringify(data) + ';');
	conf.set('lastserverget', new Date().getTime())
}

function writeSettingsToJavascript(data, response) {
	console.log('writeSettingsToJavascript')
	var settings = "var profile = '" + conf.get('profile') + "';\n" +
		"var alertrange = '"+conf.get('alertrange')+"';\n" +
		"var alertenabled = '"+conf.get('alertenabled')+"';\n" +
		"var interval = '"+conf.get('pollinginterval')+"';\n" +
		"var uptime = '"+conf.get('uptime')+"';\n" +
		"var testmode = '"+conf.get('testmode')+"';\n" +
		"var version = '"+version+"';\n" +
		"";

	const { spawnSync } = require('child_process');
	const py = spawnSync('python', ['groups.py', 'alertutil', 'query']);	
	if (files.fileExists('groups.js'))
	{	
		var contents = fs.readFileSync('groups.js', 'utf8');
		settings += contents;
	}
	
	fs.writeFileSync('settings.js', settings);
	
	//process commands
	if (files.fileExists('queryagent'))
	{
		var contents = fs.readFileSync('queryagent', 'utf8');
		fs.unlinkSync('queryagent');		
		console.log(contents);
		
		var keys = [];
		var vals = [];
		var pairs = contents.split('&');
		pairs.forEach(function(p){
			var pair = splitEqualPair(p);
			if (pair != null) {
				keys.push(pair.a);
				vals.push(pair.b);
			}
		});
		
		if (keys.indexOf('passwordset') != -1) {
			fs.writeFileSync('.server_login', vals[0]);
		}
		else if (keys.indexOf('intervalset') != -1) {
			if (validEntry(vals[1]))
				conf.set('pollinginterval', vals[1]);
		}
		else if (keys.indexOf('enabledset') != -1) {
			if (validEntry(vals[2]))
				conf.set('alertenabled', vals[2]);
		}
		else if (keys.indexOf('rangeset') != -1) {
			if (validEntry(vals[3]))
				conf.set('alertrange', vals[3]);
		}
	}	
	
	if (new Date().getTime() - conf.get('lastserverget') > 60000)
		restCalls.getData(username, password, {"active":"true"}, writeAgentsToJavascript);
}

function runCommandAndSendResponse(data, response) {
	runCommandAndSendResponseOpts(data, response, false);
}

function runCommandAndSendResponseEchoServer(data, response) {
	console.log('runCommandAndSendResponseEchoServer');
	runCommandAndSendResponseOpts(data, response, true);
}

function runCommandAndSendResponseOpts(data, response, echo) {
	console.log('runCommandAndSendResponse');
	
	//parse command
	var cmd = data.command;
	if (cmd == null)
		cmd = data.Command;
	//console.log('cmd='+cmd)

	var pair = splitColonPair(cmd);
	if (pair == null) 
	{
		if (!echo) writeSettingsToJavascript(null, null);
		return;
	}
	var cmdNum = pair.a;
	cmd = pair.b;
	
	//parse response
	var resp = data.response;
	if (resp == null)
		resp = data.Response;
	if (resp == null)
		resp = "";
	//console.log('resp='+resp)
	
	//when colon is in result,
	//we have 1.result ab:cd
	//we can also have an error,
	//like 1:some error
	var colon = resp.indexOf(':');
	if (colon == -1)
		colon = resp.indexOf('.');
	else 
	{
		var period = resp.indexOf('.');
		if (period != -1 && period < colon)
			colon = period;
	}
	
	var respNum = resp.substring(0, colon);
	resp = resp.substring(colon + 1);
	//console.log('respNum='+respNum)

	if (cmdNum == respNum)
	{
		if (!echo) writeSettingsToJavascript(null, null);
		return;
	}
	
	//run command
	//alertQuery: 		get stats
	//emailQuery: 		get email settings
	//emailConfig:  	set email settings
	//alertDataConfig: 	set report time
	//alertTest:		send test alert
	//keyQuery:			get public key
	//saveAlertPassword:set email password
	var separator = '.';
	console.log('running ' + cmd)
	if (cmd == 'getProperties') 
	{
		var contents = 'unknown';
		if (files.directoryExists('usb-thermometer-master') && files.fileExists('usb-thermometer-master/sensor.txt')) {
			contents = fs.readFileSync('usb-thermometer-master/sensor.txt', 'utf8');
		}
		//console.log('base='+files.getCurrentDirectoryBase());
		
		resp = 'pollinginterval=' + conf.get('pollinginterval') +
		' alertrange=' + conf.get('alertrange') +
		' alertenabled=' + conf.get('alertenabled') +
		' uptime=' + conf.get('uptime') + ' sensor=' + contents;
		
		if (echo) resp += ' mainserver=' + conf.get('server');
	}
	else if (echo)
	{
		resp = 'not allowed';
		separator = ':';
	}
	else if (cmd.indexOf('setTwoProperties ') == 0)
	{
		cmd = cmd.substring(17);
		var cmds = cmd.split(' ');
		//console.log(cmds);
		conf.set(cmds[0], cmds[1]);
		conf.set(cmds[2], cmds[3]);
		resp = cmds[1] + ' ' + cmds[3];
	}
	else if (cmd.indexOf('setProperty ') == 0)
	{
		pair = splitSpacePair(cmd.substring(12));
		if (pair != null) {
			conf.set(pair.a, pair.b);
			resp = pair.b;
		}
		else
			resp = 'parse error';
	}
	else if (cmd.indexOf('alertQuery') == 0)
	{
		const { spawnSync } = require('child_process');
		const py = spawnSync('python', ['groups.py', 'alertutil', 'query']);	
		resp = py.stdout.toString('utf8');
	}
	else if (cmd.indexOf('alertConfig') == 0)
	{
		resp = '';
		if (files.fileExists('groups.cfg'))
		{	
			var contents = fs.readFileSync('groups.cfg', 'utf8').split('\n');
			if (contents.length > 5)
				resp = '<br/>' + contents.slice(0,6).join('<br/>');
		}
	}
	else if (cmd.indexOf('emailConfig ') == 0)
	{
		cmd = cmd.substring(12).split('<br/>').join('\n');
		fs.writeFileSync('groups.cfg', cmd);
		resp = 'done';
	}
	else if (cmd.indexOf('alertDataConfig ') == 0)
	{
		cmd = cmd.substring(16);
		const { spawnSync } = require('child_process');
		const py = spawnSync('python', ['groups.py', 'alertutil', 'configdata', cmd]);	
		resp = py.stdout.toString('utf8');
	}
	else if (cmd.indexOf('alertTest') == 0)
	{
		const { spawnSync } = require('child_process');
		const py = spawnSync('python', ['groups.py', 'alertutil', 'test']);	
		resp = py.stdout.toString('utf8');
	}
	else if (cmd.indexOf('keyQuery') == 0)
	{
		const { spawnSync } = require('child_process');
		const py = spawnSync('python', ['groups.py', 'keys', 'test']);	
		resp = py.stdout.toString('utf8');
	}
	else if (cmd.indexOf('saveAlertPassword ') == 0)
	{
		cmd = cmd.substring(18);
		const { spawnSync } = require('child_process');
		const py = spawnSync('python', ['groups.py', 'decrypt', cmd]);	
		resp = py.stdout.toString('utf8');
	}
	else
	{
		resp = 'not implemented';
		separator = ':';
	}
	
	var data = { "Response": cmdNum + separator + resp };
	restCalls.putData(username, password, echo ? conf.get('echoserver') : null, data, null, echo ? null : writeSettingsToJavascript, null);
}

function getIps() {
	var ips = '';
	var networkInterfaces = os.networkInterfaces();
	Object.keys(networkInterfaces).forEach(function (ifname) {
		networkInterfaces[ifname].forEach(function(ifdata){
			if (ifdata.family == 'IPv4' && ifdata.address != '127.0.0.1') {
				if (ips.length > 0)
					ips += ',';
				ips += ifdata.address;
			}
		});
	});
	
	return ips;
}

function getDistro() {
	var result = '';
	if (os.type() == 'Linux' && files.fileExists('/etc/os-release')) {
		var contents = fs.readFileSync('/etc/os-release', 'utf8').split('\n').forEach(function(p){
			if (p.indexOf('NAME=') == 0) 
			{
				result = p.substring(5).replace(/"/g, "");
				var space = result.indexOf(' ');
				if (space != -1)
					result = result.substring(0, space);
			}
		});
	}
	
	return result;
}

////////////////////////////////////////////////////
function pingServer(data, response) {
	console.log('pingServer');
	
	if (response.responseUrl.indexOf('/login.html') != -1)
	{
		console.log('not logged in');
		var data = { "httpd_username": username, "httpd_password": password };
		restCalls.postData(username, password, data, null, 'cookie');
		return;
	}
	
	var ips = getIps();
	var data = { "IP": ips, "Version": version, "OS": os.type() + ' ' + os.release() + ' ' + getDistro(), "Percent":0, "Mode":0, "Profile":conf.get('profile') };
	restCalls.putData(username, password, null, data, {"update":"true"}, runCommandAndSendResponse, null);
}

function pingEchoServer(data, response) {
	console.log('pingEchoServer');
	
	var ips = getIps();
	var data = { "IP": ips, "Version": version, "OS": os.type() + ' ' + os.release() + ' ' + getDistro(), "Percent":0, "Mode":0, "Profile":conf.get('profile') };
	restCalls.putData(username, password, conf.get('echoserver'), data, {"update":"true"}, runCommandAndSendResponseEchoServer, null);
}

////////////////////////////////////////////////////
function registerAgent(data, response) {
	console.log('registerAgent');
		
	if (response.responseUrl.indexOf('/login.html') != -1)
	{
		console.log('not logged in');
		var data = { "httpd_username": username, "httpd_password": password };
		restCalls.postData(username, password, data, null, 'cookie');
		return;
	}

	//try to get unused id
	if (data.length > 0 && (data[0].Id != null || data[0].id != null))
	{
		var newid = data[0].Id;
		if (newid == null)
			newid = data[0].id;
		
		console.log('registerAgent: found id of ' + newid);
		conf.set('id', newid);
		handleId('id', newid);
	}
	else
	{
		//register new agent
		var data = { "Name": os.hostname(), "IP": getIps(), "Version": version, "OS": os.type() + ' ' + os.release(), "Status":"", "Profile":conf.get('profile') };
		restCalls.postData(username, password, data, null, 'id', handleId);
	}
}

function sendOutput(url, isalert, fileContents) {
	console.log('sendOutput')
	
	if (conf.get('id') == '-1')
	{
		restCalls.getData(username, password, {"unused":"y"}, registerAgent);
		return;
	}
	
	var output = conf.get('profile') + "\n" + (isalert ? '1' : '') + "\n1\n" + url + "\nPIC\n0:" + fileContents;
	var encoded = Buffer.from(output).toString('base64');
	var data = { "Output": encoded };
	restCalls.putData(username, password, null, data, null, pingServer, writeSettingsToJavascript);
	if (conf.get('echoserver') != '')
		restCalls.putData(username, password, conf.get('echoserver'), data, null, pingEchoServer, null);
}

function parseContentsForAlert(fileContents) {
	if (conf.get('alertenabled') != '1')
		return 0;
	
	var re = conf.get('alertregex');
	var found = fileContents.match(new RegExp(re,'i'));
	if (found != null)
	{
		//console.log(found[1]);
		
		var isalert = 0;
		var pair = splitPair(conf.get('alertrange'), '-');
		if (found[1] > pair.b || found[1] < pair.a) {
			console.log('out of range');
			isalert = 1;
			const { spawnSync } = require('child_process');
			const py = spawnSync('python', ['groups.py', 'alert', conf.get('profile') + '=' + found[1]]);	
		}		
		
		const { spawnSync } = require('child_process');
		const py = spawnSync('python', ['groups.py', 'alertdata', found[1]]);	
		return isalert;
	}
	
	return 0;
}

function handleId(key, val) {
	if (key == 'id') {
		fs.writeFileSync('id.txt', val);
	}
}

function optionalArgs() {
	if (argv._[1] != null) {
		if (argv._[1] == 'set') {
			if (argv._[2] == null) {
				console.log('usage: set key=val');
			}
			else {
				var pair = splitEqualPair(argv._[2])
				if (pair != null) {
					conf.set(pair.a, pair.b);
					handleId(pair.a, pair.b);
				}
				else
					console.log('usage: set key=val');
			}
			process.exit(1);
		}
		
		if (argv._[1] == 'get') {
			if (argv._[2] == null) {
				console.log('usage: get key');
			}
			else {
				console.log(conf.get(argv._[2]));
			}
			process.exit(1);
		}
		
		if (argv._[1] == 'uptime') {
			conf.set('uptime', (new Date).toUTCString().replace(/ /g, "_").substring(5));
			process.exit(1);
		}
		
		console.log('valid options: get|set|uptime');
		process.exit(1);
	}
}

conf = new Configstore('agent', 
	{
		server: 		'localhost', 
		echoserver: 	'', 
		id: 			'-1', 
		profile: 		'temperature', 
		pollinginterval: '10', 
		uptime: 		'unknown', 
		alertrange: 	'50-90', 
		alertenabled: 	'0', 
		alertregex: 	'([.0-9]+)[CF]',
		profurl:		'file://usb-thermometer-master/out2.txt.lck',
		profregex:		'.*',
		testmode:		'',
		lastserverget:	0
	}
	);

//required command-line args
if (argv._[0] == null) {
	console.log('missing creds');
	process.exit(1);
}

var pair = splitColonPair(argv._[0]);
if (pair == null) {
	console.log('missing colon from ' + argv._[0]);
	process.exit(1);
}

username = pair.a;
password = pair.b;

optionalArgs();

//TODO: remove block
//conf.set('profile','temptest');
//conf.set('profurl','file://out2.txt.lck');
//
if (typeof conf.get('session-'+conf.get('server')) == 'undefined')
	conf.set('session-'+conf.get('server'),'')

if (files.directoryExists('lib')) {
	console.log('lib exists')
}

//begin agent
try 
{
	console.log('server=' + conf.get('server'));
	
	//TODO: support http
	var url = conf.get('profurl');
	if (url.indexOf('file://') != 0)
	{
		console.log('unsupported URL type in ' + conf.get('profurl'));
		return;
	}
	
	//TODO: apply profregex
	var filename = url.substring(7);
	var contents = '';
	var doRead = true;
	if (filename.endsWith('.lck'))
	{
		filename = filename.slice(0, -4);
		const { spawnSync } = require('child_process');
		const py = spawnSync('python', ['lock.py', filename]);	
		contents = py.stdout.toString('utf8');
		if (py.stderr.toString('utf8').length < 1)
			doRead = false;
	}
	
	if (doRead && files.fileExists(filename))
		contents = fs.readFileSync(filename, 'utf8');

	var isalert = parseContentsForAlert(contents);
	sendOutput(url, isalert, contents);
} 
catch (err) 
{
	console.log(err)
}
