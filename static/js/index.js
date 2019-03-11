
require("jquery")($ => {

	const ko = require("knockout");

	ko.options.deferUpdates = true;

	class ViewModel extends require("events") {

		constructor(){
			super();

			const root = this;
			const self = root;

			self.ws = initWs(new WebSocket(`ws${window.location.toString().slice(4)}ws/`));

			self.globals = { ko, $ };

			self.status = ko.observable("waiting");

			self.intro = new (require("./intro"))(root);
			self.ginrummy = new (require("./ginrummy"))(root);

			return self;

			function initWs(ws){
				ws.s = function(type, ...data){
					this.send(JSON.stringify([type, ...data]));
				}

				ws.addEventListener("message", ({ data: message }) => {
					let [type, ...data] = JSON.parse(message);
					// console.log(type, ...data);
					self.emit("ws", { type, data });

					switch(type) {
						case "status":
							self.status(data[0]);
							break;
					}
				})

				return ws;
			}
		}

	}

	ko.applyBindings(new ViewModel());

});
