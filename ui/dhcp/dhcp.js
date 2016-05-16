// Copyright © 2016 Jeffery Harrell <jefferyharrell@gmail.com>
// See file 'LICENSE' for use and warranty information.
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

define(
    ['freeipa/ipa', 'freeipa/menu', 'freeipa/phases', 'freeipa/reg', 'freeipa/rpc', 'freeipa/net'],
    function(IPA, menu, phases, reg, rpc, NET) {


        var exp = IPA.dhcp = {};


//// Validators ///////////////////////////////////////////////////////////////


        IPA.dhcprange_validator = function(spec) {

            spec = spec || {};
            spec.message = spec.message || 'Range must be of the form x.x.x.x y.y.y.y, where x.x.x.x is the first IP address in the pool and y.y.y.y is the last IP address in the pool.';
            var that = IPA.validator(spec);

            that.validate = function(value) {
                if (IPA.is_empty(value)) return that.true_result();

                that.address_type = 'IPv4';

                var components = value.split(" ");
                if (components.length != 2) {
                    return that.false_result();
                }

                var start = NET.ip_address(components[0]);
                var end = NET.ip_address(components[1]);

                if (!start.valid || start.type != 'v4-quads' || !end.valid || end.type != 'v4-quads') {
                    return that.false_result();
                }

                return that.true_result();
            };

            that.dhcprange_validate = that.validate;
            return that;
        };


        IPA.dhcprange_subnet_validator = function(spec) {
            spec = spec || {};
            spec.message = spec.message || 'Invalid IP range.';
            var that = IPA.validator(spec);

            that.validate = function(value, context) {
                if (context.container.rangeIsValid) {
                    return that.true_result();
                }
                that.message = context.container.invalidRangeMessage;
                return that.false_result();
            }

            that.dhcprange_subnet_validate = that.validate;
            return that;
        };


//// Factories ////////////////////////////////////////////////////////////////


        IPA.dhcp.dhcppool_adder_dialog = function(spec) {
            spec = spec || {};
            var that = IPA.entity_adder_dialog(spec);

            that.previous_dhcprange = [];

            that.rangeIsValid = false;
            that.invalidRangeMessage = "Invalid IP range."

            that.create_content = function() {
                that.entity_adder_dialog_create_content();
                var dhcprange_widget = that.fields.get_field('dhcprange').widget;
                dhcprange_widget.value_changed.attach(that.dhcprange_changed);
            };

            that.dhcprange_changed = function() {

                var dhcprange_widget = that.fields.get_field('dhcprange').widget;
                var dhcprange = dhcprange_widget.get_value();
                var name_widget = that.fields.get_field('cn').widget;
                var name = name_widget.get_value();

                if (name.length == 0) {
                    name_widget.update(dhcprange);
                }

                if (name.length > 0 && name[0] == that.previous_dhcprange) {
                    name_widget.update(dhcprange);
                }

                that.previous_dhcprange = dhcprange;

                var firstValidationResult = that.fields.get_field('dhcprange').validators[0].validate(that.fields.get_field('dhcprange').get_value()[0])

                if (firstValidationResult.valid) {
                    setValidFlagCommand = rpc.command({
                        entity: 'dhcppool',
                        method: 'is_valid',
                        args: that.pkey_prefix.concat([dhcprange]),
                        options: {},
                        retry: false,
                        on_success: that.setValidFlag
                    });
                    setValidFlagCommand.execute();
                }
            }

            that.setValidFlag = function(data, text_status, xhr) {
                that.rangeIsValid = data.result.result;
                that.invalidRangeMessage = data.result.value;
                that.validate();
            }

            return that;
        }


//// dhcpservice //////////////////////////////////////////////////////////////


        var make_dhcpservice_spec = function() {
            return {
                name: 'dhcpservice',
                defines_key: false,
                facets: [
                    {
                        $type: 'details',
                        sections: [
                            {
                                name: 'options',
                                label: 'Options',
                                fields: [
                                    {
                                        name: 'domainname',
                                        flags: ['w_if_no_aci']
                                    },
                                    {
                                        $type: 'multivalued',
                                        name: 'domainnameservers',
                                        flags: ['w_if_no_aci']
                                    },
                                    {
                                        $type: 'multivalued',
                                        name: 'domainsearch',
                                        flags: ['w_if_no_aci']
                                    },
                                    {
                                        name: 'defaultleasetime',
                                        measurement_unit: 'seconds',
                                        flags: ['w_if_no_aci']
                                    },
                                    {
                                        name: 'maxleasetime',
                                        measurement_unit: 'seconds',
                                        flags: ['w_if_no_aci']
                                    },
                                ]
                            },
                            {
                                name: 'dhcpparameters',
                                label: 'DHCP Parameters',
                                fields: [
                                    {
                                        name: 'dhcpprimarydn',
                                        read_only: true,
                                        formatter: 'dn'
                                    },
                                    {
                                        $type: 'multivalued',
                                        name: 'dhcpsecondarydn',
                                        read_only: true,
                                        formatter: 'dn'
                                    },
                                    {
                                        $type: 'multivalued',
                                        name: 'dhcpstatements',
                                    },
                                    {
                                        $type: 'multivalued',
                                        name: 'dhcpoption',
                                    },
                                    {
                                        $type: 'textarea',
                                        name: 'dhcpcomments'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };
        };
        exp.dhcpservice_entity_spec = make_dhcpservice_spec();


//// dhcpsubnet ///////////////////////////////////////////////////////////////


        var make_dhcpsubnet_spec = function() {
            return {
                name: 'dhcpsubnet',
                facet_groups: ['settings', 'dhcppoolfacetgroup'],
                facets: [
                    {
                        $type: 'search',
                        columns: [
                            'cn',
                            'dhcpnetmask',
                            'dhcpcomments'
                        ]
                    },
                    {
                        $type: 'details',
                        sections: [
                            {
                                name: 'options',
                                label: 'Options',
                                fields: [
                                    {
                                        name: 'router',
                                        flags: ['w_if_no_aci'],
                                        validators: [ 'ip_v4_address' ]
                                    }
                                ]
                            },
                            {
                                name: 'dhcpparameters',
                                label: 'DHCP Parameters',
                                fields: [
                                    {
                                        name: 'cn',
                                        read_only: true
                                    },
                                    {
                                        name: 'dhcpnetmask',
                                        read_only: true
                                    },
                                    {
                                        $type: 'multivalued',
                                        name: 'dhcpstatements'
                                    },
                                    {
                                        $type: 'multivalued',
                                        name: 'dhcpoption'
                                    },
                                    {
                                        $type: 'textarea',
                                        name: 'dhcpcomments'
                                    }
                                ]
                            }
                        ],
                    },
                    {
                        $type: 'nested_search',
                        facet_group: 'dhcppoolfacetgroup',
                        nested_entity: 'dhcppool',
                        search_all_entries: true,
                        label: 'DHCP Pools',
                        tab_label: 'DHCP Pools',
                        name: 'dhcppools',
                        columns: [
                            {
                                name: 'cn'
                            },
                            'dhcpcomments'
                        ]
                    }
                ],
                adder_dialog: {
                    method: 'add_cidr',
                    fields: [
                        {
                            name: 'networkaddr',
                            label: 'Subnet/Prefix',
                            validators: [ 'network' ]
                        },
                        {
                            $type: 'textarea',
                            name: 'dhcpcomments'
                        }
                    ]
                }
            };
        };
        exp.dhcpsubnet_entity_spec = make_dhcpsubnet_spec();


//// dhcppool /////////////////////////////////////////////////////////////////


        var make_dhcppool_spec = function() {
            return {
                name: 'dhcppool',
                containing_entity: 'dhcpsubnet',
                facets: [
                    {
                        $type: 'details',
                        sections: [
                            {
                                name: 'options',
                                label: 'Options',
                                fields: [
                                    {
                                        name: 'defaultleasetime',
                                        measurement_unit: 'seconds',
                                        flags: ['w_if_no_aci']
                                    },
                                    {
                                        name: 'maxleasetime',
                                        measurement_unit: 'seconds',
                                        flags: ['w_if_no_aci']
                                    },
                                    {
                                        $type: 'checkbox',
                                        name: 'permitknownclients',
                                        flags: ['w_if_no_aci']
                                    },
                                    {
                                        $type: 'checkbox',
                                        name: 'permitunknownclients',
                                        flags: ['w_if_no_aci']
                                    },
                                ]
                            },
                            {
                                name: 'dhcpparameters',
                                label: 'DHCP Parameters',
                                fields: [
                                    {
                                        name: 'cn'
                                    },
                                    {
                                        name: 'dhcprange',
                                        read_only: true
                                    },
                                    {
                                        $type: 'multivalued',
                                        name: 'dhcppermitlist'
                                    },
                                    {
                                        $type: 'multivalued',
                                        name: 'dhcpstatements'
                                    },
                                    {
                                        $type: 'multivalued',
                                        name: 'dhcpoption'
                                    },
                                    {
                                        $type: 'textarea',
                                        name: 'dhcpcomments'
                                    }
                                ]
                            }
                        ]
                    }
                ],
                adder_dialog: {
                    $factory: IPA.dhcp.dhcppool_adder_dialog,
                    fields: [
                        {
                            name: 'dhcprange',
                            validators: [
                                {
                                    $type: 'dhcprange',
                                },
                                {
                                    $type: 'dhcprange_subnet',
                                },
                            ]
                        },
                        {
                            name: 'cn'
                        },
                        {
                            $type: 'textarea',
                            name: 'dhcpcomments'
                        }
                    ]
                }
            };
        };
        exp.dhcppool_entity_spec = make_dhcppool_spec();


//// dhcpserver ///////////////////////////////////////////////////////////////


        var make_dhcpserver_spec = function() {
            return {
                name: 'dhcpserver',
                facets: [
                    {
                        $type: 'search',
                        columns: [
                            'cn',
                        ]
                    },
                    {
                        $type: 'details',
                        sections: [
                            {
                                name: 'settings',
                                fields: [
                                    {
                                        $type: 'multivalued',
                                        name: 'dhcpstatements'
                                    },
                                    {
                                        $type: 'multivalued',
                                        name: 'dhcpoption'
                                    },
                                    {
                                        $type: 'textarea',
                                        name: 'dhcpcomments'
                                    }
                                ]
                            }
                        ],
                    }
                ],
                adder_dialog: {
                    fields: [
                        {
                            $type: 'entity_select',
                            name: 'cn',
                            other_entity: 'host',
                            other_field: 'fqdn',
                            required: true
                        }
                    ]
                }
            };
        };
        exp.dhcpserver_entity_spec = make_dhcpserver_spec();


//// exp.register /////////////////////////////////////////////////////////////


        exp.register = function() {
            var v = reg.validator;
            v.register('dhcprange', IPA.dhcprange_validator);
            v.register('dhcprange_subnet', IPA.dhcprange_subnet_validator);

            var e = reg.entity;
            e.register({type: 'dhcpservice', spec: exp.dhcpservice_entity_spec});
            e.register({type: 'dhcpsubnet', spec: exp.dhcpsubnet_entity_spec});
            e.register({type: 'dhcppool', spec: exp.dhcppool_entity_spec});
            e.register({type: 'dhcpserver', spec: exp.dhcpserver_entity_spec});
        }


//// menu spec ////////////////////////////////////////////////////////////////


        exp.dhcp_menu_spec = {
            name: 'dhcp',
            label: 'DHCP',
            children: [
                {
                    entity: 'dhcpservice',
                    label: 'Configuration'
                },
                {
                    entity: 'dhcpsubnet',
                    label: 'Subnets',
                    children: [
                        {
                            entity: 'dhcppool',
                            hidden: true
                        }
                    ]
                },
                {
                    entity: 'dhcpserver',
                    label: 'Servers'
                }
            ]
        }

        exp.add_menu_items = function() {
            menu.add_item( exp.dhcp_menu_spec, 'network_services' );
        };


//// customize_host_ui ////////////////////////////////////////////////////////


        exp.customize_host_ui = function() {
            var adder_dialog = IPA.host.entity_spec.adder_dialog;
            var fields = adder_dialog.sections[1].fields;
            var macaddress_field_spec = {
                $type: 'multivalued',
                name: 'macaddress'
            }
            fields.splice(2, 0, macaddress_field_spec)
        };


//// phases ///////////////////////////////////////////////////////////////////


        phases.on('customization', exp.customize_host_ui);
        phases.on('registration', exp.register);
        phases.on('profile', exp.add_menu_items, 20);

        return exp;

    }
);
