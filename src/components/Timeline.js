import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { isArrayOfSizesEqual, isSizeEqual } from '../utils'
import styles from '../styles.css'

// todo: functional + hooks
class Timeline extends Component {
  constructor (props) {
    super(props)
    const { from, to, cols, rows } = this.props

    this.colsHeaderRef = React.createRef()
    this.rowsRefs = rows.map(React.createRef)
    this.elementsRefs = rows.reduce((acc, row, rowIndex) => {
      acc[rowIndex] = row.elements.map(React.createRef)
      return acc
    }, {})
    this.currentTimeLabelRef = React.createRef()

    const duration = Math.round((to.getTime() - from.getTime()) / 1000)

    this.state = {
      colsHeaderSize: undefined,
      currentTimeLabelSize: undefined,
      horizontalOffset: undefined,
      rowSizes: undefined,
      colWidth: undefined,
      // rows summary height
      summaryRowsHeight: undefined,
      colsCount: cols.length,
      rowsCount: rows.length,
      duration,
      gutter: 5
    }
  }

  componentDidMount () {
    window.addEventListener('resize', this.handleResize)
    window.requestAnimationFrame(() => {
      this.handleLayoutChange()
    })
  }

  componentWillUnmount () {
    window.removeEventListener('resize', this.handleResize)
  }

  calculateSize = (ref) => ({
    width: ref.current.offsetWidth,
    height: ref.current.offsetHeight
  })

  calculateRowSize = rowIndex => {
    // we find max value of width and height because children are absolute positioned
    const width = Math.max(...this.elementsRefs[rowIndex]
      .map(ref => ref.current.offsetWidth + ref.current.offsetLeft)
    )
    const height = Math.max(...this.elementsRefs[rowIndex]
      .map(ref => ref.current.offsetHeight)
    )

    return ({
      width: width, // this.rowsRefs[rowIndex].current.offsetWidth,
      height: height // this.rowsRefs[rowIndex].current.offsetHeight
    })
  }

  calculateScale = (width, duration) => {
    return width / duration
  }

  // this value is maximal width of any col, we use overflow: hidden to prevent to expand them
  calculateColWidth (width, count) {
    return Math.ceil(width / count)
  }

  handleLayoutChange = () => {
    const { fixedColWidth, current } = this.props
    const { colsHeaderSize, currentTimeLabelSize, rowSizes, duration, colsCount } = this.state

    const nextColHeaderSize = this.calculateSize(this.colsHeaderRef)

    // получили значение ширины
    if (colsHeaderSize === undefined || !isSizeEqual(nextColHeaderSize, colsHeaderSize)) {
      const scale = this.calculateScale(nextColHeaderSize.width, duration)

      // we use fixed width or calculate it base on current cols header width
      const colWidth = fixedColWidth === undefined
        ? this.calculateColWidth(nextColHeaderSize.width, colsCount)
        : fixedColWidth

      const horizontalOffset = Math.round(colWidth / 2)

      this.setState({
        colsHeaderSize: nextColHeaderSize,
        horizontalOffset,
        colWidth,
        scale
      })
    }

    const nextRowsSize = this.props.rows.map((_, i) => this.calculateRowSize(i))
    if (rowSizes === undefined || !isArrayOfSizesEqual(rowSizes, nextRowsSize)) {
      this.setState({
        rowSizes: nextRowsSize,
        summaryRowsHeight: nextRowsSize.reduce((acc, v) => acc + v.height, 0)
      })
    }

    if (current) {
      const nextCurrentTimeLabelSize = this.calculateSize(this.currentTimeLabelRef)
      if (currentTimeLabelSize === undefined || !isSizeEqual(nextCurrentTimeLabelSize, currentTimeLabelSize)) {
        this.setState({
          currentTimeLabelSize: nextCurrentTimeLabelSize
        })
      }
    }
  }

  handleResize = () => this.handleLayoutChange()

  handleElementClick = (element, rowIndex) => e => {
    if (!this.props.handleElementClick) {
      return
    }
    this.props.handleElementClick(element, rowIndex, e)
  }

  timeToOffset = date => {
    const { from } = this.props
    const { horizontalOffset } = this.state
    return Math.round(this.state.scale * ((date.getTime() - from.getTime()) / 1000)) + horizontalOffset
  }

  renderRowsHeader = () => {
    const { rows, rowsHeaderClass, renderRowHeader } = this.props
    const { colsHeaderSize, rowSizes } = this.state

    return <div
      className={[rowsHeaderClass, styles.rowsHeader].join(' ')}
      style={{ paddingTop: colsHeaderSize.height + 'px' }}
    >
      {rows.map((row, rowIndex) => {
        const style = {
          height: rowSizes[rowIndex].height + 'px',
        }

        return (
          <div
            key={row.key}
            className={styles.rowsHeaderItem}
            style={style}
          >
            {renderRowHeader(row)}
          </div>
        )
      })}
    </div>
  }

  renderColsHeader = () => {
    const { cols, colsHeaderClass, renderColHeader } = this.props
    const { colWidth } = this.state
    const colStyle = {
      width: colWidth ? colWidth + 'px' : null
    }

    return <div
      ref={this.colsHeaderRef}
      className={[colsHeaderClass, styles.colsHeader].join(' ')}
    >
      {cols.map(col => (
        <div
          key={col.key}
          className={styles.col}
          style={colStyle}
        >
          {renderColHeader(col)}
        </div>
      ))}
    </div>
  }

  renderHorizontalLine = (x, y, width, color) => (<div
    key={x + '-' + y}
    className={[this.props.gridLineClass, styles.gridLine].join(' ')}
    style={{
      position: 'absolute',
      borderBottom: `1px solid ${color}`,
      width: width + 'px',
      left: x + 'px',
      top: y + 'px'
    }}
  />)

  renderVerticalLine = (x, y, height, color) => (<div
    key={x + '-' + y}
    className={[this.props.gridLineClass, styles.gridLine].join(' ')}
    style={{
      position: 'absolute',
      borderLeft: `1px solid ${color}`,
      height: height + 'px',
      left: x + 'px',
      top: y + 'px'
    }}
  />)

  // todo: allow customize
  renderGrid = () => {
    const { gridColor } = this.props
    const { colsHeaderSize, colsCount, colWidth, rowSizes, summaryRowsHeight, horizontalOffset, gutter } = this.state

    const res = []

    // rows
    let y = 0
    y += colsHeaderSize.height
    for (let rowSize of rowSizes) {
      res.push(this.renderHorizontalLine(0, y, colsHeaderSize.width, gridColor))
      y += rowSize.height
    }

    // last line
    res.push(this.renderHorizontalLine(0, y, colsHeaderSize.width, gridColor))

    // cols
    let x = horizontalOffset
    for (let j = 0; j < colsCount; j++) {
      res.push(this.renderVerticalLine(x, colsHeaderSize.height - gutter, summaryRowsHeight, gridColor))
      x += colWidth
    }

    // last line
    res.push(this.renderVerticalLine(x, colsHeaderSize.height - gutter, summaryRowsHeight, gridColor))

    return res
  }

  renderCurrentTimeLine = () => {
    const { current, currentTimeOverlapClass, timeFormatFunction } = this.props
    const { summaryRowsHeight, colsHeaderSize, gutter } = this.state
    const x = this.timeToOffset(current)

    return <div
      key={x}
      style={{
        position: 'absolute',
        top: colsHeaderSize.height + 'px',
        left: 0,
        width: x + 'px'
      }}
      className={currentTimeOverlapClass}
    >
      <div
        style={{
          height: summaryRowsHeight + 'px'
        }}
        className='overlap'
      />
      <div
        ref={this.currentTimeLabelRef}
        style={{
          position: 'absolute',
          bottom: -(gutter) + 'px',
          right: 0,
          transform: 'translate(50%, 100%)'
        }}
        className='label'
      >
        {timeFormatFunction(current)}
      </div>
    </div>
  }

  render () {
    const { rows, rowsBodyClass, maxWidth, current, renderElement } = this.props
    const { colsHeaderSize, rowSizes, colWidth, summaryRowsHeight } = this.state

    const style = {
      maxWidth: maxWidth ? maxWidth + 'px' : null
    }

    return (
      <div
        className={styles.root}
        style={style}
      >
        {colsHeaderSize && rowSizes && this.renderRowsHeader()}

        <div
          className={[rowsBodyClass, styles.rowsBody].join(' ')}
        >
          {colWidth && summaryRowsHeight && this.renderGrid()}
          {colWidth && summaryRowsHeight && current && this.renderCurrentTimeLine()}
          {this.renderColsHeader()}

          {rows.map((row, rowIndex) => {
            const rowStyle = {}
            if (rowSizes) {
              rowStyle.width = rowSizes[rowIndex].width + 'px'
              rowStyle.height = rowSizes[rowIndex].height + 'px'
            }

            return (
              <div
                key={row.key}
                ref={this.rowsRefs[rowIndex]}
                className={styles.row}
                style={rowStyle}
              >
                {row.elements.map((element, elementIndex) => {
                  const x1 = this.timeToOffset(element.start)
                  const x2 = this.timeToOffset(element.end)
                  const elementStyle = { left: x1 + 'px', width: (x2 - x1) + 'px' }

                  return (
                    <div
                      key={element.key}
                      ref={this.elementsRefs[rowIndex][elementIndex]}
                      onClick={this.handleElementClick(element, rowIndex)}
                      className={styles.element}
                      style={elementStyle}
                    >
                      {renderElement(element)}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
}

Timeline.propTypes = {
  from: PropTypes.instanceOf(Date).isRequired,
  to: PropTypes.instanceOf(Date).isRequired,
  current: PropTypes.instanceOf(Date),
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      elements: PropTypes.arrayOf(
        PropTypes.shape({
          key: PropTypes.string.isRequired,
          start: PropTypes.instanceOf(Date).isRequired,
          end: PropTypes.instanceOf(Date).isRequired
        })
      ).isRequired
    })
  ).isRequired,
  cols: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      start: PropTypes.instanceOf(Date).isRequired,
      end: PropTypes.instanceOf(Date).isRequired
    })
  ).isRequired,
  maxWidth: PropTypes.number,
  fixedColWidth: PropTypes.number,
  gridColor: PropTypes.string,
  renderElement: PropTypes.func.isRequired,
  renderColHeader: PropTypes.func.isRequired,
  renderRowHeader: PropTypes.func.isRequired,
  handleElementClick: PropTypes.func,
  timeFormatFunction: PropTypes.func,
  // todo: validate with requiredIf or make yours validator
  currentTimeOverlapClass: PropTypes.string,
  rowsHeaderClass: PropTypes.string,
  colsHeaderClass: PropTypes.string,
  gridLineClass: PropTypes.string,
  rowsBodyClass: PropTypes.string,
}

export default Timeline
