import React, { Component } from 'react';
import PropTypes from 'prop-types';

import Grid from '@material-ui/core/Grid';

import I18n from '@iobroker/adapter-react/i18n';
import ConfirmDialog from '@iobroker/adapter-react/Dialogs/Confirm';
import IconInfo from '@material-ui/icons/Info';
import IconWarning from '@material-ui/icons/Warning';
import IconError from '@material-ui/icons/Error';

class ConfigGeneric extends Component {
    static DIFFERENT_VALUE = '__different__';
    static DIFFERENT_LABEL  = I18n.t('__different__');
    static AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

    constructor(props) {
        super(props);

        this.state = {
            confirmDialog: false,
            confirmNewValue: null,
            confirmAttr: null,
            confirmData: null,
        };

        this.lang = I18n.getLanguage();
    }

    componentDidMount() {
    }

    componentWillUnmount() {
    }

    getValue(data, attr) {
        if (typeof attr === 'string') {
            return this.getValue(data, attr.split('.'));
        } else {
            if (attr.length === 1) {
                return data[attr[0]];
            } else {
                const part = attr.shift();
                if (typeof data[part] === 'object') {
                    return this.getValue(data[part], attr);
                } else {
                    return null;
                }
            }
        }
    }

    setValue(data, attr, value) {
        if (typeof attr === 'string') {
            return this.setValue(data, attr.split('.'), value);
        } else {
            if (attr.length === 1) {
                data[attr[0]] = value;
            } else {
                const part = attr.shift();
                if (!data[part] || typeof data[part] === 'object') {
                    data[part] = data[part] || {};
                }
                return this.setValue(data[part], attr, value);
            }
        }
    }

    getText(text, noTranslation) {
        if (!text) {
            return '';
        }
        if (typeof text === 'string') {
            return noTranslation ? text : I18n.t(text);
        } else if (text && typeof text === 'object') {
            return text[this.lang] || text.en || '';
        }
    }

    renderConfirmDialog() {
        if (!this.state.confirmDialog) {
            return null;
        }
        const confirm = this.state.confirmData || this.props.schema.confirm;
        let icon = null;
        if (confirm.type === 'warning') {
            icon = <IconWarning />;
        } else if (confirm.type === 'error') {
            icon = <IconError />;
        } else if (confirm.type === 'info') {
            icon = <IconInfo />;
        }


        return <ConfirmDialog
            title={ this.getText(confirm.title) || I18n.t('Please confirm') }
            text={ this.getText(confirm.text) }
            ok={ this.getText(confirm.ok) || I18n.t('Ok') }
            cancel={ this.getText(confirm.cancel) || I18n.t('Cancel') }
            icon={icon}
            onClose={isOk =>
                this.setState({ confirmDialog: false}, () => {
                    if (isOk) {
                        const data = JSON.parse(JSON.stringify(this.props.data));
                        this.setValue(data, this.state.confirmAttr, this.state.confirmNewValue);
                        this.setState({confirmDialog: false, confirmNewValue: null, confirmAttr: null, confirmOldValue: null, confirmData: null}, () =>
                            this.props.onChange(data));
                    } else {
                        this.setState({confirmDialog: false, confirmNewValue: null, confirmAttr: null, confirmOldValue: null, confirmData: null});
                    }
                })
            }
        />;
    }

    onChange(attr, newValue) {
        const data = JSON.parse(JSON.stringify(this.props.data));
        this.setValue(data, attr, newValue);
        if (this.props.schema.confirm && this.execute(this.props.schema.confirm.condition, false, data)) {
            return this.setState({
                confirmDialog: true,
                confirmNewValue: newValue,
                confirmAttr: attr,
                confirmData: null,
            });
        } else {
            // find any inputs with confirmation
            if (this.props.schema.depends) {
                for (let z = 0; z < this.props.schema.depends.length; z++) {
                    const dep = this.props.schema.depends[z];
                    if (dep.confirm) {
                        const val = this.getValue(data, dep.attr);

                        if (this.execute(dep.confirm.condition, false, data)) {
                            return this.setState({
                                confirmDialog: true,
                                confirmNewValue: val,
                                confirmAttr: dep.attr,
                                confirmData: dep.confirm,
                            });
                        }
                    }
                }
            }

            this.props.onChange(data);
        }
    }

    execute(func, defaultValue, data) {
        if (!func) {
            return defaultValue;
        } else {
            try {
                // eslint-disable-next-line no-new-func
                const f = new Function('data', '_system', '_alive', '_common', '_socket', func.includes('return') ? func : 'return ' + func);
                const result = f(data || this.props.data, this.props.systemConfig, this.props.alive, this.props.common, this.props.socket);
                console.log(result);
                return result;
            } catch (e) {
                console.error(`Cannot execute ${func}: ${e}`);
                return defaultValue;
            }
        }
    }

    calculate(schema) {
        const error        = schema.validator   ? this.execute(schema.validator,   true)    : false;
        const disabled     = schema.disabled    ? this.execute(schema.disabled,    false)   : false;
        const hidden       = schema.hidden      ? this.execute(schema.hidden,      false)   : false;
        const defaultValue = schema.defaultFunc ? this.execute(schema.defaultFunc, schema.default) : schema.default;

        return {error, disabled, hidden, defaultValue};
    }

    renderItem(error, disabled, defaultValue) {
        return this.getText(this.props.schema.label) || this.getText(this.props.schema.text)
    }

    getPattern(pattern) {
        if (!pattern) {
            return '';
        } else {
            try {
                // eslint-disable-next-line no-new-func
                const f = new Function('data', '_system', '_alive', '_common', '_socket', 'return `' + pattern.replace(/`/g, '\\`') + '`');
                return f(this.props.data, this.props.systemConfig, this.props.alive, this.props.common, this.props.socket);
            } catch (e) {
                console.error(`Cannot execute ${pattern}: ${e}`);
                return pattern;
            }
        }
    }

    render() {
        const {error, disabled, hidden, defaultValue} = this.calculate(this.props.schema);

        if (hidden) {
            return null;
        }

        const schema = this.props.schema;

        const item = <Grid
            item
            title={this.getText(this.props.schema.tooltip)}
            xs={schema.xs || undefined}
            lg={schema.lg || undefined}
            md={schema.md || undefined}
            sm={schema.sm || undefined}

            style={Object.assign({}, {marginBottom: 0, marginRight: 8}, this.props.schema.style)}>
            {this.renderItem(error, disabled, defaultValue)}
        </Grid>;

        if (schema.newLine) {
            return <>
                <div style={{flexBasis: '100%', height: 0}} />
                {this.renderConfirmDialog()}
                {item}
            </>
        } else {
            if (this.state.confirmDialog) {
                return <>
                    {this.renderConfirmDialog()}
                    {item}
                </>;
            } else {
                return item;
            }
        }
    }
}

ConfigGeneric.propTypes = {
    socket: PropTypes.object.isRequired,
    data: PropTypes.object,
    schema: PropTypes.object,
    attr: PropTypes.string,
    value: PropTypes.any,
    themeName: PropTypes.string,
    style: PropTypes.object,
    onError: PropTypes.func,
    onChange: PropTypes.func,
    customs: PropTypes.object,

    systemConfig: PropTypes.object,
    alive: PropTypes.bool,
    common: PropTypes.object,
};

export default ConfigGeneric;