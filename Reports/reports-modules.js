// reports-modules.js
// Modular Report System for easy addition/removal of reports

// Data processing utilities
const ReportUtils = {
    // Parse date from various formats
    parseDate: (dateStr) => {
        if (!dateStr) return null;
        try {
            return new Date(dateStr);
        } catch (e) {
            return null;
        }
    },

    // Extract class info from Shopify line items
    extractClassInfo: (lineItem) => {
        const title = lineItem.title?.toLowerCase() || '';
        const variant = lineItem.variant_title?.toLowerCase() || '';
        
        const classInfo = {
            className: '',
            term: '',
            block: '',
            role: '',
            isFree: false,
            isBundle: false
        };

        // Check if free class
        if (title.includes('free class')) {
            classInfo.isFree = true;
            classInfo.className = 'Free Class - New York Salsa';
        }
        
        // Extract class name
        if (title.includes('level 1')) classInfo.className = 'Level 1';
        else if (title.includes('level 2')) classInfo.className = 'Level 2';
        else if (title.includes('level 3')) classInfo.className = 'Level 3';
        else if (title.includes('body movement')) classInfo.className = 'Body Movement';
        else if (title.includes('shines')) classInfo.className = 'Shines';
        else if (title.includes('unlimited bundle') || title.includes('platinum bundle')) {
            classInfo.isBundle = true;
            classInfo.className = 'Bundle';
        }

        // Extract term and block
        if (variant.includes('term 2b')) {
            classInfo.term = '2';
            classInfo.block = 'b';
        } else if (variant.includes('term 2a')) {
            classInfo.term = '2';
            classInfo.block = 'a';
        } else if (variant.includes('term 2') && !variant.includes('term 1') && !variant.includes('term 3')) {
            classInfo.term = '2';
            classInfo.block = 'both';
        }

        // Extract role
        if (variant.includes('leader')) classInfo.role = 'Leader';
        else if (variant.includes('follower')) classInfo.role = 'Follower';
        else if (classInfo.className === 'Body Movement' || classInfo.className === 'Shines') {
            classInfo.role = 'No Role';
        }

        return classInfo;
    },

    // Group data by key
    groupBy: (array, key) => {
        return array.reduce((result, item) => {
            const group = item[key];
            if (!result[group]) result[group] = [];
            result[group].push(item);
            return result;
        }, {});
    },

    // Calculate percentage
    percentage: (part, total) => {
        if (total === 0) return '0%';
        return ((part / total) * 100).toFixed(2) + '%';
    }
};

// Report Module Definitions
const ReportModules = {
    // 1. Enrollment Analysis Report
    enrollmentAnalysis: {
        name: 'Term 2b Enrollment Analysis',
        description: 'Analyze who enrolled in Term 2b vs Term 2a',
        category: 'enrollment',
        
        run: (data) => {
            const { shopifyOrders } = data;
            if (!shopifyOrders || shopifyOrders.length === 0) {
                return { error: 'No Shopify orders available' };
            }

            const customerEnrollments = {};

            // Process each order
            shopifyOrders.forEach(order => {
                if (!order.customer?.id) return;
                
                const customerId = order.customer.id;
                if (!customerEnrollments[customerId]) {
                    customerEnrollments[customerId] = {
                        customer_id: customerId,
                        name: `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim(),
                        email: order.customer.email || '',
                        enrollments_2a: [],
                        enrollments_2b: [],
                        has_bundle: false
                    };
                }

                // Process line items
                order.line_items?.forEach(item => {
                    const classInfo = ReportUtils.extractClassInfo(item);
                    
                    if (classInfo.isBundle) {
                        customerEnrollments[customerId].has_bundle = true;
                    }

                    if (classInfo.term === '2') {
                        const enrollment = {
                            class: classInfo.className,
                            role: classInfo.role,
                            order_id: order.id,
                            order_date: order.created_at
                        };

                        if (classInfo.block === 'a' || classInfo.block === 'both') {
                            customerEnrollments[customerId].enrollments_2a.push(enrollment);
                        }
                        if (classInfo.block === 'b' || classInfo.block === 'both') {
                            customerEnrollments[customerId].enrollments_2b.push(enrollment);
                        }
                    }
                });
            });

            // Analyze results
            const results = {
                total_customers: Object.keys(customerEnrollments).length,
                enrolled_2a: 0,
                enrolled_2b: 0,
                enrolled_both: 0,
                not_enrolled_2b: [],
                conversion_rate: '0%',
                by_class: {}
            };

            Object.values(customerEnrollments).forEach(customer => {
                const has2a = customer.enrollments_2a.length > 0;
                const has2b = customer.enrollments_2b.length > 0;

                if (has2a) results.enrolled_2a++;
                if (has2b) results.enrolled_2b++;
                if (has2a && has2b) results.enrolled_both++;
                if (has2a && !has2b) {
                    results.not_enrolled_2b.push({
                        name: customer.name,
                        email: customer.email,
                        classes_2a: [...new Set(customer.enrollments_2a.map(e => e.class))]
                    });
                }

                // Track by class
                customer.enrollments_2b.forEach(enrollment => {
                    if (!results.by_class[enrollment.class]) {
                        results.by_class[enrollment.class] = 0;
                    }
                    results.by_class[enrollment.class]++;
                });
            });

            results.conversion_rate = results.enrolled_2a > 0 
                ? ReportUtils.percentage(results.enrolled_both, results.enrolled_2a)
                : '0%';

            return results;
        }
    },

    // 2. Revenue Analysis Report
    revenueAnalysis: {
        name: 'Revenue Analysis',
        description: 'Analyze revenue by term, class type, and time period',
        category: 'financial',
        
        run: (data) => {
            const { shopifyOrders } = data;
            if (!shopifyOrders || shopifyOrders.length === 0) {
                return { error: 'No Shopify orders available' };
            }

            const analysis = {
                total_revenue: 0,
                by_month: {},
                by_class_type: {},
                by_term: {},
                average_order_value: 0,
                top_products: []
            };

            // Process orders
            shopifyOrders.forEach(order => {
                const amount = parseFloat(order.total_price || 0);
                analysis.total_revenue += amount;

                // Group by month
                const date = new Date(order.created_at);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                analysis.by_month[monthKey] = (analysis.by_month[monthKey] || 0) + amount;

                // Analyze line items
                order.line_items?.forEach(item => {
                    const classInfo = ReportUtils.extractClassInfo(item);
                    const itemRevenue = parseFloat(item.price || 0) * (item.quantity || 1);

                    // By class type
                    if (classInfo.className) {
                        analysis.by_class_type[classInfo.className] = 
                            (analysis.by_class_type[classInfo.className] || 0) + itemRevenue;
                    }

                    // By term
                    if (classInfo.term) {
                        const termKey = `Term ${classInfo.term}${classInfo.block ? classInfo.block : ''}`;
                        analysis.by_term[termKey] = (analysis.by_term[termKey] || 0) + itemRevenue;
                    }
                });
            });

            // Calculate average order value
            analysis.average_order_value = shopifyOrders.length > 0
                ? (analysis.total_revenue / shopifyOrders.length).toFixed(2)
                : 0;

            // Sort months chronologically
            analysis.by_month = Object.fromEntries(
                Object.entries(analysis.by_month).sort()
            );

            return analysis;
        }
    },

    // 3. Customer Retention Report
    customerRetention: {
        name: 'Customer Retention Analysis',
        description: 'Analyze customer repeat purchases and retention',
        category: 'customer',
        
        run: (data) => {
            const { shopifyOrders, customers } = data;
            if (!shopifyOrders || shopifyOrders.length === 0) {
                return { error: 'No data available' };
            }

            const customerPurchases = {};

            // Track purchases per customer
            shopifyOrders.forEach(order => {
                if (!order.customer?.id) return;
                
                const customerId = order.customer.id;
                if (!customerPurchases[customerId]) {
                    customerPurchases[customerId] = {
                        customer_id: customerId,
                        name: `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim(),
                        email: order.customer.email || '',
                        orders: [],
                        total_spent: 0,
                        first_purchase: null,
                        last_purchase: null
                    };
                }

                const orderDate = new Date(order.created_at);
                customerPurchases[customerId].orders.push({
                    order_id: order.id,
                    date: orderDate,
                    amount: parseFloat(order.total_price || 0)
                });
                
                customerPurchases[customerId].total_spent += parseFloat(order.total_price || 0);
                
                // Update first and last purchase dates
                if (!customerPurchases[customerId].first_purchase || 
                    orderDate < customerPurchases[customerId].first_purchase) {
                    customerPurchases[customerId].first_purchase = orderDate;
                }
                if (!customerPurchases[customerId].last_purchase || 
                    orderDate > customerPurchases[customerId].last_purchase) {
                    customerPurchases[customerId].last_purchase = orderDate;
                }
            });

            // Analyze retention
            const retention = {
                total_customers: Object.keys(customerPurchases).length,
                one_time_customers: 0,
                repeat_customers: 0,
                vip_customers: 0, // 3+ purchases
                retention_rate: '0%',
                average_customer_value: 0,
                customer_segments: {
                    new: [],
                    returning: [],
                    vip: []
                }
            };

            Object.values(customerPurchases).forEach(customer => {
                const orderCount = customer.orders.length;
                
                if (orderCount === 1) {
                    retention.one_time_customers++;
                    retention.customer_segments.new.push(customer);
                } else if (orderCount === 2) {
                    retention.repeat_customers++;
                    retention.customer_segments.returning.push(customer);
                } else if (orderCount >= 3) {
                    retention.repeat_customers++;
                    retention.vip_customers++;
                    retention.customer_segments.vip.push(customer);
                }
            });

            retention.retention_rate = ReportUtils.percentage(
                retention.repeat_customers, 
                retention.total_customers
            );

            retention.average_customer_value = retention.total_customers > 0
                ? (Object.values(customerPurchases).reduce((sum, c) => sum + c.total_spent, 0) / retention.total_customers).toFixed(2)
                : 0;

            return retention;
        }
    },

    // 4. Class Popularity Report
    classPopularity: {
        name: 'Class Popularity Analysis',
        description: 'Analyze which classes are most popular',
        category: 'classes',
        
        run: (data) => {
            const { shopifyOrders } = data;
            if (!shopifyOrders || shopifyOrders.length === 0) {
                return { error: 'No Shopify orders available' };
            }

            const classStats = {};
            const roleStats = { Leader: 0, Follower: 0, 'No Role': 0 };
            let totalEnrollments = 0;

            // Process all orders
            shopifyOrders.forEach(order => {
                order.line_items?.forEach(item => {
                    const classInfo = ReportUtils.extractClassInfo(item);
                    
                    if (classInfo.className && classInfo.className !== 'Bundle') {
                        if (!classStats[classInfo.className]) {
                            classStats[classInfo.className] = {
                                count: 0,
                                revenue: 0,
                                by_role: { Leader: 0, Follower: 0, 'No Role': 0 },
                                by_term: {}
                            };
                        }

                        classStats[classInfo.className].count++;
                        classStats[classInfo.className].revenue += parseFloat(item.price || 0);
                        
                        if (classInfo.role) {
                            classStats[classInfo.className].by_role[classInfo.role]++;
                            roleStats[classInfo.role]++;
                        }

                        if (classInfo.term && classInfo.block) {
                            const termKey = `${classInfo.term}${classInfo.block}`;
                            classStats[classInfo.className].by_term[termKey] = 
                                (classStats[classInfo.className].by_term[termKey] || 0) + 1;
                        }

                        totalEnrollments++;
                    }
                });
            });

            // Sort by popularity
            const sortedClasses = Object.entries(classStats)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([className, stats]) => ({
                    class: className,
                    ...stats,
                    percentage: ReportUtils.percentage(stats.count, totalEnrollments)
                }));

            return {
                total_enrollments: totalEnrollments,
                classes: sortedClasses,
                role_distribution: roleStats,
                most_popular: sortedClasses[0]?.class || 'N/A',
                least_popular: sortedClasses[sortedClasses.length - 1]?.class || 'N/A'
            };
        }
    },

    // 5. Free Class Conversion Report
    freeClassConversion: {
        name: 'Free Class Conversion',
        description: 'Track conversion from free classes to paid enrollments',
        category: 'conversion',
        
        run: (data) => {
            const { shopifyOrders } = data;
            if (!shopifyOrders || shopifyOrders.length === 0) {
                return { error: 'No Shopify orders available' };
            }

            const customerJourney = {};

            // Track customer journey through orders
            shopifyOrders
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                .forEach(order => {
                    if (!order.customer?.id) return;
                    
                    const customerId = order.customer.id;
                    if (!customerJourney[customerId]) {
                        customerJourney[customerId] = {
                            customer_id: customerId,
                            name: `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim(),
                            has_free_class: false,
                            has_paid_class: false,
                            free_class_date: null,
                            first_paid_date: null,
                            days_to_convert: null
                        };
                    }

                    order.line_items?.forEach(item => {
                        const classInfo = ReportUtils.extractClassInfo(item);
                        
                        if (classInfo.isFree && !customerJourney[customerId].has_free_class) {
                            customerJourney[customerId].has_free_class = true;
                            customerJourney[customerId].free_class_date = new Date(order.created_at);
                        } else if (!classInfo.isFree && classInfo.className) {
                            if (!customerJourney[customerId].has_paid_class) {
                                customerJourney[customerId].has_paid_class = true;
                                customerJourney[customerId].first_paid_date = new Date(order.created_at);
                                
                                // Calculate conversion time
                                if (customerJourney[customerId].free_class_date) {
                                    const daysDiff = Math.floor(
                                        (customerJourney[customerId].first_paid_date - customerJourney[customerId].free_class_date) 
                                        / (1000 * 60 * 60 * 24)
                                    );
                                    customerJourney[customerId].days_to_convert = daysDiff;
                                }
                            }
                        }
                    });
                });

            // Analyze conversion
            const analysis = {
                total_free_class_customers: 0,
                converted_customers: 0,
                conversion_rate: '0%',
                average_days_to_convert: 0,
                conversion_timeline: {
                    same_day: 0,
                    within_week: 0,
                    within_month: 0,
                    over_month: 0
                },
                converted_list: [],
                not_converted_list: []
            };

            let totalConversionDays = 0;
            let conversionCount = 0;

            Object.values(customerJourney).forEach(journey => {
                if (journey.has_free_class) {
                    analysis.total_free_class_customers++;
                    
                    if (journey.has_paid_class) {
                        analysis.converted_customers++;
                        analysis.converted_list.push({
                            name: journey.name,
                            days_to_convert: journey.days_to_convert
                        });
                        
                        if (journey.days_to_convert !== null) {
                            totalConversionDays += journey.days_to_convert;
                            conversionCount++;
                            
                            if (journey.days_to_convert === 0) {
                                analysis.conversion_timeline.same_day++;
                            } else if (journey.days_to_convert <= 7) {
                                analysis.conversion_timeline.within_week++;
                            } else if (journey.days_to_convert <= 30) {
                                analysis.conversion_timeline.within_month++;
                            } else {
                                analysis.conversion_timeline.over_month++;
                            }
                        }
                    } else {
                        analysis.not_converted_list.push({
                            name: journey.name,
                            free_class_date: journey.free_class_date
                        });
                    }
                }
            });

            analysis.conversion_rate = ReportUtils.percentage(
                analysis.converted_customers,
                analysis.total_free_class_customers
            );

            analysis.average_days_to_convert = conversionCount > 0
                ? (totalConversionDays / conversionCount).toFixed(1)
                : 0;

            return analysis;
        }
    },

    // 6. Enrollment Timing Analysis Report
    enrollmentTiming: {
        name: 'Enrollment Timing Analysis',
        description: 'Analyze when students sign up for Term 2b classes relative to class start date',
        category: 'enrollment',
        
        run: (data, options = {}) => {
            const { shopifyOrders } = data;
            if (!shopifyOrders || shopifyOrders.length === 0) {
                return { error: 'No Shopify orders available' };
            }

            // Date configuration
            const classStartDate = options.classStartDate || new Date('2024-06-10');
            const earlyStartDate = options.earlyStartDate || new Date('2024-05-20');
            const earlyEndDate = options.earlyEndDate || new Date('2024-06-09');

            const enrollments = [];
            const enrollmentsByDay = {};
            const enrollmentsByLevel = {
                'Level 1': { early: 0, dayOf: 0 },
                'Level 2': { early: 0, dayOf: 0 },
                'Level 3': { early: 0, dayOf: 0 }
            };
            const roleBreakdown = {
                early: { Leader: 0, Follower: 0 },
                dayOf: { Leader: 0, Follower: 0 }
            };

            // Filter and process relevant orders
            shopifyOrders
                .filter(order => {
                    const orderDate = new Date(order.created_at);
                    return orderDate >= earlyStartDate && orderDate <= classStartDate;
                })
                .forEach(order => {
                    const orderDate = new Date(order.created_at);
                    const dayKey = orderDate.toISOString().split('T')[0];
                    const isDayOf = orderDate.toDateString() === classStartDate.toDateString();
                    const daysBeforeClass = Math.floor((classStartDate - orderDate) / (1000 * 60 * 60 * 24));

                    // Initialize day counter
                    if (!enrollmentsByDay[dayKey]) {
                        enrollmentsByDay[dayKey] = 0;
                    }

                    // Process line items
                    order.line_items?.forEach(item => {
                        const classInfo = ReportUtils.extractClassInfo(item);
                        
                        // Only process Term 2b Level 1/2/3 classes
                        if (classInfo.block === 'b' && classInfo.term === '2' && 
                            ['Level 1', 'Level 2', 'Level 3'].includes(classInfo.className)) {
                            
                            enrollments.push({
                                orderId: order.id,
                                orderNumber: order.name,
                                customerName: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim(),
                                customerId: order.customer?.id,
                                level: classInfo.className,
                                role: classInfo.role,
                                orderDate: orderDate,
                                daysBeforeClass: daysBeforeClass,
                                isDayOf: isDayOf
                            });

                            // Update counts
                            if (isDayOf) {
                                enrollmentsByLevel[classInfo.className].dayOf++;
                                if (classInfo.role) roleBreakdown.dayOf[classInfo.role]++;
                            } else {
                                enrollmentsByLevel[classInfo.className].early++;
                                if (classInfo.role) roleBreakdown.early[classInfo.role]++;
                            }

                            enrollmentsByDay[dayKey]++;
                        }
                    });
                });

            // Find most popular enrollment day
            let mostPopularDay = null;
            let maxEnrollments = 0;
            Object.entries(enrollmentsByDay).forEach(([day, count]) => {
                if (count > maxEnrollments) {
                    maxEnrollments = count;
                    mostPopularDay = day;
                }
            });

            // Calculate average days early (excluding day-of enrollments)
            const earlyEnrollments = enrollments.filter(e => !e.isDayOf);
            const avgDaysEarly = earlyEnrollments.length > 0
                ? (earlyEnrollments.reduce((sum, e) => sum + e.daysBeforeClass, 0) / earlyEnrollments.length).toFixed(1)
                : 0;

            // Calculate totals
            const totalEarly = Object.values(enrollmentsByLevel).reduce((sum, level) => sum + level.early, 0);
            const totalDayOf = Object.values(enrollmentsByLevel).reduce((sum, level) => sum + level.dayOf, 0);

            return {
                enrollments: enrollments,
                byLevel: enrollmentsByLevel,
                byDay: enrollmentsByDay,
                roleBreakdown: roleBreakdown,
                mostPopularDay: mostPopularDay,
                mostPopularDayCount: maxEnrollments,
                avgDaysEarly: avgDaysEarly,
                totalEnrollments: enrollments.length,
                summary: {
                    totalEarly: totalEarly,
                    totalDayOf: totalDayOf,
                    percentDayOf: totalEarly + totalDayOf > 0 
                        ? ReportUtils.percentage(totalDayOf, totalEarly + totalDayOf) 
                        : '0%'
                }
            };
        }
    }
};

// Export for use in HTML
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ReportModules, ReportUtils };
}