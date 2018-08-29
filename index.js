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

var version  = '0.0.1b';
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

////////////////////////////////////////////////////
function runCommandAndSendResponse(data, response) {
	console.log('runCommandAndSendResponse')
	//console.log(data)
	
	//parse command
	var cmd = data.command;
	if (cmd == null)
		cmd = data.Command;

	var pair = splitColonPair(cmd);
	if (pair == null)
		return;
	var cmdNum = pair.a;
	cmd = pair.b;
	
	//parse response
	var resp = data.response;
	if (resp == null)
		resp = data.Response;
	if (resp == null)
		resp = "";
	
	var colon = resp.indexOf(':');
	if (colon == -1)
		colon = resp.indexOf('.');
	var respNum = resp.substring(0, colon);
	resp = resp.substring(colon + 1);

	if (cmdNum == respNum)
		return;
	
	//run command
	console.log('running ' + cmd)
	if (cmd == 'getProperties')
		resp = 'pollinginterval=' + conf.get('pollinginterval') +
		' alertrange=' + conf.get('alertrange') +
		' alertenabled=' + conf.get('alertenabled') +
		' uptime=' + conf.get('uptime');
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
	else if (cmd.indexOf('alertDataConfig ') == 0)
	{
		cmd = cmd.substring(16);
		const { spawnSync } = require('child_process');
		const py = spawnSync('python', ['groups.py', 'alertutil', 'configdata', cmd]);	
		resp = py.stdout.toString('utf8');
	}
	else
		resp = 'not implemented';
	
	var data = { "Response": cmdNum + "." + resp };
	restCalls.putData(username, password, data, null, null);
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

////////////////////////////////////////////////////
function pingServer(data, response) {
	console.log('pingServer');
	
	var ips = getIps();
	var data = { "IP": ips, "Version": version, "OS": os.type() + ' ' + os.release(), "Percent":0, "Mode":0, "Profile":conf.get('profile') };
	restCalls.putData(username, password, data, {"update":"true"}, runCommandAndSendResponse);
}

////////////////////////////////////////////////////
function sendOutput(fileContents) {
	console.log('sendOutput')
	
	if (conf.get('id') == '-1')
	{
		//register agent
		var data = { "Name": os.hostname(), "IP": getIps(), "Version": version, "OS": os.type() + ' ' + os.release(), "Status":"", "Profile":conf.get('profile') };
		restCalls.postData(username, password, data, null);
		return;
	}
	
	var output = conf.get('profile') + "\n\n1\nURL\nPIC\nPIC2\n0:" + fileContents + "\n0:test";
	var encoded = Buffer.from(output).toString('base64');
	var data = { "Output": encoded };
	restCalls.putData(username, password, data, null, pingServer);
}

function parseContentsForAlert(fileContents) {
	if (conf.get('alertenabled') != '1')
		return;
	
	var re = conf.get('alertregex');
	var found = fileContents.match(new RegExp(re,'i'));
	if (found != null)
	{
		//console.log(found[1]);
		
		var pair = splitPair(conf.get('alertrange'), '-');
		if (found[1] > pair.b || found[1] < pair.a) {
			console.log('out of range');
			const { spawnSync } = require('child_process');
			const py = spawnSync('python', ['groups.py', 'alert', conf.get('profile') + '=' + found[1]]);	
		}		
		
		const { spawnSync } = require('child_process');
		const py = spawnSync('python', ['groups.py', 'alertdata', found[1]]);	
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
				if (pair != null)
					conf.set(pair.a, pair.b);
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
		id: 			'-1', 
		profile: 		'temperature', 
		pollinginterval: '10', 
		uptime: 		'unknown', 
		alertrange: 	'50-90', 
		alertenabled: 	'0', 
		alertregex: 	'([.0-9]+)[CF]',
		profurl:		'file://out.txt',
		profregex:		'.*'
	}
	);

//required command-line args
if (argv._[0] == null) {
	console.log('missing creds');
	process.exit(1);
}

var pair = splitColonPair(argv._[0]);
if (pair == null) {
	console.log('missing colon');
	process.exit(1);
}

username = pair.a;
password = pair.b;

optionalArgs();

//TODO: remove
conf.set('profile','temptest');

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
	var contents = fs.readFileSync(url.substring(7), 'utf8');
	
	parseContentsForAlert(contents);
	sendOutput(contents);
} 
catch (err) 
{
	//console.log('out.txt does not exist')
	console.log(err)
}
