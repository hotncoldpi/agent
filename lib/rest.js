//https://www.npmjs.com/package/node-rest-client
var Client = require('node-rest-client').Client;
const Configstore = require('configstore');

module.exports = {

	getData : (user, pass, params, func) => {

		conf = new Configstore('agent');
		
		var options_auth = { 
			user: user, 
			password: pass,
			connection: { rejectUnauthorized:false }
		};
		
		var client = new Client(options_auth);
		
		var args = {
			parameters: params,
			headers: { "Content-Type": "application/json", "Cookie": conf.get('session-'+conf.get('server')) }
		};
		
		var server = conf.get('server');
		if (server.indexOf('http') != 0) 
			server = 'https://' + server;
		client.get(server + "/WebApp/api/products/", args, function(data, response) {
			if (response.statusCode == 200) {
				if (func) 
					func(data, response);
			}
			else
				console.log(response.statusCode);
		});
		
	},

	putData : (user, pass, server, data, params, func, errorfunc) => {
		
		conf = new Configstore('agent');
		
		if (server == null)
			server = conf.get('server');
			
		var options_auth = { 
			user: user, 
			password: pass,
			connection: { rejectUnauthorized:false }
		};
		
		var client = new Client(options_auth);
		
		var args = {
			data: data,
			parameters: params,
			headers: { "Content-Type": "application/json", "Cookie": conf.get('session-'+server) }
		};

		if (server.indexOf('http') != 0) 
			server = 'https://' + server;
		client.put(server + "/WebApp/api/products/" + conf.get('id'), args, function(data, response) {
			if (response.statusCode == 200) {
				if (func) 
					func(data, response);
			}
			else {
				console.log(response.statusCode);
				if (errorfunc) 
					errorfunc(data, response);
			}
		});
	},
	
	postData : (user, pass, data, params, operation, idfunc) => {
		var options_auth = { 
			user: user, 
			password: pass,
			connection: { rejectUnauthorized:false }
		};
		
		var client = new Client(options_auth);
		
		var args = {
			requestConfig: { followRedirects:(operation == 'id' ? true : false) },		
			data: data,
			parameters: params,
			headers: { "Content-Type": "application/x-www-form-urlencoded",
				"Cookie": (operation == 'id' ? conf.get('session-'+conf.get('server')) : '')
			}
		};
		//console.log(args.headers)

		//console.log("https://" + conf.get('server') + "/WebApp/api/products/")
		var server = conf.get('server');
		if (server.indexOf('http') != 0) 
			server = 'https://' + server;
			
		client.post(server + (operation == 'id' ? "/WebApp/api/products/" : "/dologin.html"), args, function(data, response) {
			if (response.statusCode == 200) {
				//TODO: move to func like putData above
				if (operation == 'id') {
					var id = data.id;
					if (id == null)
						id = data.Id;
					conf.set('id', id);
					idfunc('id',id);
				}
				else {
					console.log(response.rawHeaders)
				}
			}
			else {
				if (operation == 'id') 
					console.log(response.statusCode);
				else if (response.statusCode == 302) {
					//console.log(response.rawHeaders)
					response.rawHeaders.forEach(function(h){
						if (h.indexOf('session=') == 0) {
							console.log(h)
							var index = h.indexOf(';');
							conf.set('session-'+conf.get('server'), h.substring(0, index));
						}
					}); 
				}
			}
		});
	}
};
