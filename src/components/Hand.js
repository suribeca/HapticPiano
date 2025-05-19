import React from 'react';

class Hand extends React.Component {
  render() {
    const colors = this.props.fingerColors;

    return (
      React.createElement('svg', { width: 300, height: 200, viewBox: "0 0 200 200" }, [
        React.createElement('rect', { key: 'thumb', x: 30, y: 80, width: 20, height: 50, fill: colors.thumb }),
        React.createElement('rect', { key: 'index', x: 60, y: 40, width: 20, height: 90, fill: colors.index }),
        React.createElement('rect', { key: 'middle', x: 90, y: 30, width: 20, height: 100, fill: colors.middle }),
        React.createElement('rect', { key: 'ring', x: 120, y: 40, width: 20, height: 90, fill: colors.ring }),
        React.createElement('rect', { key: 'pinky', x: 150, y: 60, width: 15, height: 70, fill: colors.pinky }),
        React.createElement('rect', { key: 'palm', x: 60, y: 130, width: 80, height: 40, fill: "#c49b6c" }),
      ])
    );
  }
}

export { Hand };
