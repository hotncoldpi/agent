//https://www.npmjs.com/package/node-rest-client
var Client = require('node-rest-client').Client;
const Configstore = require('configstore');

module.exports = {
	putData : (user, pass, data, params, func) => {
		
		conf = new Configstore('agent');
		
		var options_auth = { 
			user: user, 
			password: pass,
			connection: { rejectUnauthorized:false }
		};
		
		var client = new Client(options_auth);
		
		var args = {
			data: data,
			parameters: params,
			headers: { "Content-Type": "application/json" }
		};

		client.put("https://" + conf.get('server') + "/WebApp/api/products/" + conf.get('id'), args, function(data, response) {
			if (response.statusCode == 200) {
				if (func) 
					func(data, response);
			}
			else
				console.log(response.statusCode);
		});
	},
	
	postData : (user, pass, data, params) => {
		var options_auth = { 
			user: user, 
			password: pass,
			connection: { rejectUnauthorized:false }
		};
		
		var client = new Client(options_auth);
		
		var args = {
			data: data,
			parameters: params,
			headers: { "Content-Type": "application/json" }
		};

		//console.log("https://" + conf.get('server') + "/WebApp/api/products/")
		
		client.post("https://" + conf.get('server') + "/WebApp/api/products/", args, function(data, response) {
			if (response.statusCode == 200) {
				//TODO: move to func like putData above
				var id = data.id;
				if (id == null)
					id = data.Id;
				conf.set('id', id);
			}
			else
				console.log(response.statusCode);
		});
	}
};
