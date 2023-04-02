function setup(state, subscriber) {
  state.connection.on('data', function (data) {
    subscriber.receive(state, data);
  });
  state.connection.on('close', function () {
    state.connection = null;
    subscriber.close(state);
  });
}

function startPeerConnection(subscriber) {
  const state = {
    connection: null,
    peer: new Peer(),
    send: (message) => state.connection === null ? -1 : state.connection.send(message),
    real_join: (id) => {
      if (state.connection)
        state.connection.close();
      state.connection = state.peer.connect(id, {
        reliable: true,
      });
      subscriber.join_connection(state);
      state.connection.on('open', function () {
        subscriber.connection_open(state);
      });
      setup(state, subscriber);
    },
    destroy: () => state.peer.destroy(),
    join2: () => (state.join = state.real_join),
    join: (id) => {
      state.join2 = () => state.real_join(id);
      return state;
    }
  };
  state.peer.on('open', function (id) {
    subscriber.assign_signal(state);
  });
  state.peer.on('connection', function (connection) {
    state.connection = connection;
    subscriber.peer_connection(state);
    setup(state, subscriber);
  });
  state.peer.on('disconnected', function () {
    state.peer.reconnect();
    subscriber.disconnected(state);
  });
  state.peer.on('close', function() {
    state.connection = null;
    subscribe.close(state);
  });
  state.peer.on('error', function (err) {
    subscriber.error(state, err);
  });
  subscriber.send = state.send;
  return state;
}

window.startPeerConnection = startPeerConnection;
