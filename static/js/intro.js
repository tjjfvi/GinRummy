
module.exports = class {

	constructor(root){
		const { ko } = root.globals;
		const self = this;

		self.games = ko.observable([]);

		self.host = {
			name: ko.observable(""),
			pswd: ko.observable(""),
			host: () => {
				root.ws.s("host", self.host.name(), self.host.pswd());
			}
		}

		root.on("ws", ({ type, data }) => {
			if(type === "games")
				self.games(data[0].map(g => new Game(g)));
		})

		class Game {

			constructor({ name, pswd, id }){
				const self = this;

				self.name = name;
				self.pswdReq = pswd;
				self.pswd = ko.observable("");
				self.wrong = ko.observable(false);

				self.join = () => {
					root.ws.s("join", id, self.pswd());
					root.on("ws", ({ type }) => {
						if(type === "joinFailed")
							self.wrong(true);
					})
				}
			}

		}

		return self;
	}

}
