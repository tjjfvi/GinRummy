
const animationDuration = 1000;
const { calcDeadwood, value } = require("../../calcDeadwood");

module.exports = class {

	constructor(root){
		const { ko, $ } = root.globals;
		const { ws } = root;
		const self = this;
		const ginrummy = self;

		self.n = ko.observable();
		self.oHand = ko.observableArray("?".repeat(10).split(""));
		self.hand = ko.observableArray("?".repeat(10).split(""));
		self.phase = ko.observable();
		self.discard = ko.observable("?");
		self.no = ko.observable();
		self.willKnock = ko.observable(false);

		self.score = ko.observable(0);
		self.oScore = ko.observable(0);

		self.deadwoodCalc = ko.computed(() => calcDeadwood(self.hand()));
		self._deadwoodTotal = ko.observable();
		self.deadwoodTotal = ko.computed(() => self._deadwoodTotal() || self.deadwoodCalc().deadwoodTotal);
		self._deadwood = ko.observable();
		self.deadwood = ko.computed(() => self._deadwood() || self.deadwoodCalc().deadwood);

		self.oDeadwoodTotal = ko.observable("???");
		self.oDeadwood = ko.observable([]);

		self.melds = ko.observable([]);
		self.oMelds = ko.observable([]);

		self.canDraw = ko.computed(() => self.phase() === self.n());
		self.canDiscard = ko.computed(() => self.phase() === self.n() + .5);

		self.ok = ko.observable(false);

		self.drawDeck = () => {
			if(!self.canDraw()) return;
			ws.s("move", "deck");
			self.hand.push("?")
			self.no(null);
		}

		self.drawDiscard = () => {
			if(!self.canDraw()) return;
			ws.s("move", "discard");
			self.hand.push(self.discard());
			self.no(self.discard());
			self.discard("?");
		}

		self.discardCard = card => {
			if(!self.canDiscard() || card === self.no()) return;
			self.hand.remove(card);
			self.discard(card);
			ws.s("move", "discard", card, self.willKnock());
			self.willKnock(false);
		}

		self.knock = () => {
			if(self.deadwoodTotal() > 0)
				return self.willKnock(!self.willKnock());
			ws.s("move", "knock");
		}

		self.sendOk = () => {
			self.ok(true);
			ws.s("move", "ok");
		}

		self.value = value;

		root.on("ws", ({ type, data }) => {
			if(type === "hand")
				self.hand(data[0]);
			if(type === "phase")
				self.phase(data[0]);
			if(type === "n")
				self.n(data[0]);
			if(type === "initCard" && self.n() === 1)
				self.oHand.push(data[0]);
			if(type === "discard") {
				self.discard(data[0]);
				if(self.phase() === (self.n() + 1) % 2 + .5) {
					let ind = self.oHand.indexOf(data[0]);
					if(ind === -1) ind = self.oHand().lastIndexOf("?");
					console.log(ind);
					(cardMap[$(".oHand .card").eq(ind).attr("id")] || { change: () => {} }).change(data[0]);
					self.oHand.splice(ind, 1);
				}
			}
			if(type === "drew") {
				setTimeout(() => {
					cardMap[$(".hand .card").eq(self.hand.indexOf("?")).attr("id")].change(data[0]);
					self.hand.replace("?", data[0]);
				}, 1000);
			} if(type === "o:deck")
				self.oHand.unshift("?");
			if(type === "o:discard") {
				self.oHand.push(self.discard())
				self.discard("?")
			}

			if(type === "end") {
				self.ok(false);
				let [s1, s2] = data;
				let s  = self.n() === 0 ? s1 : s2;
				let oS = self.n() !== 0 ? s1 : s2;
				self.score(s.score);
				self._deadwood(s.deadwood);
				self.melds(s.melds);
				self._deadwoodTotal(s.deadwoodTotal);
				self.oScore(oS.score);
				self.oDeadwood(oS.deadwood);
				self.oMelds(oS.melds);
				self.oDeadwoodTotal(oS.deadwoodTotal);
				[].concat(...oS.melds, oS.deadwood).reduce((i, c) => {
					if(~self.oHand().indexOf(c))
						return i;
					cardMap[$(".oHand .card").eq(i).attr("id")].change(c);
					return ++i;
				}, 0);

				self.hand([]);
				self.oHand([]);

				console.log(self.melds());
			}

			if(type === "start") {
				console.log(self.oHand());
				self.oMelds([]);
				self.melds([]);
				self._deadwood([]);
				self._deadwoodTotal(0);
				self.oDeadwoodTotal("???");
				self.oDeadwood([]);
				self.phase(-2);
				self.oHand("?".repeat(10).split(""));
				pauseAnimation = true;
				setTimeout(() => {
					cards.splice(0, cards.length);
					for(let key in cardMap) delete cardMap[key];
					$("._card").offset($(".deck").offset());
					$(".card:not(.discard)").removeAttr("id");
					setTimeout(() => {
						$("._card").remove();
						pauseAnimation = false;
						animate();
					}, 400);
				}, 0);
			}

			if(type === "fin") {
				$("body").addClass("fin").html(`You ${
					self.score() > self.oScore() ?
						"won!" :
					self.score() === self.oScore() ?
						"tied." :
						"lost."
				}<br>${self.score()} — ${self.oScore()}`);
			}
		})

		const cards = [];
		const cardMap = {};
		let pauseAnimation = false;

		function animate(){
			if(pauseAnimation) return;
			cards.forEach(c => c.update());
			$(".card:not([id])").each((_, el) => new Card($(el)))
			window.requestAnimationFrame(animate);
		}

		function genId(){
			return "card-" + require("crypto").randomBytes(4).toString("hex");
		}

		class Card {
			constructor($el){
				cards.push(this);
				this.card = $el.attr("data-card");
				let id = this.id = this.card === "?" ? genId() : this.card;
				cardMap[id] = this;
				$el.attr("id", id);
				this.$ = $("<div>")
					.addClass("_card hide")
					.attr("id", "_" + id)
					.attr("data-card", $el.attr("data-card"))
					.offset($(".deck").offset())
					.appendTo(".ginrummy")
				;
			}

			update(){
				let ease = n => (3*n**2 + 2*n**3)/5;

				let $el = $(`#${this.id}${this.card === "?" ? "" : `,.card[data-card=${this.card}]`}`);
				if(!$el.length) {
					this.$.remove();
					cards.splice(cards.indexOf(this), 1);
				}
				$el.attr("id", this.id);

				let offset = $el.offset();

				if(!offset) offset = { left: 0, top: 0 };

				this.$
					.attr("data-card", this.card)
					.toggleClass("hide", $el.attr("data-card") === "?")
					.css("opacity", offset.left === 0 && offset.top === 0 ? 0 : "")

				this.$.offset($el.offset());
			}

			change(card){
				$(`#_${this.id}`).attr("id", "_" + (this.id = this.card = card));
			}
		}

		window.requestAnimationFrame(animate);
	}

}
